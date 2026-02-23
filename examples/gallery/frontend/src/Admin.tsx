import { useMutation, useQuery } from "@tanstack/react-query";
import { readAccountFile, Account } from "lib";
import { storeGetter } from "./utils";
import { useState } from "react";
import { AccountViewPage } from "./AccountView";
import { MainLayout } from "./MainLayout";
import { getRepoIOConfig } from "./io-config";
import { queryClient } from "./account-hooks";
import { stringToUint8Array } from "lib/src/utils";
import { Button, Flex, Loader, PasswordInput, Text } from "@mantine/core";

// TEMP
function create16ByteBuffer(str: string): Uint8Array {
  const array = stringToUint8Array(str);
  const result = new Uint8Array(16);
  result.set(array.subarray(0, 16), 0);
  return result;
}

const AccountCreation = () => {
  const [password, setPassword] = useState<string | undefined>();
  const { mutate: onClick, isPending } = useMutation({
    mutationFn: async () => {
      if (password === undefined) {
        return;
      }
      const store = storeGetter.get(undefined);
      await Account.createAccount(
        store,
        storeGetter,
        getRepoIOConfig(),
        create16ByteBuffer(password),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accountFile"] });
    },
  });
  return (
    <MainLayout
      Header={<Text>Create Account</Text>}
      Content={
        <Flex m={5} direction={"column"}>
          <PasswordInput
            size="sm"
            label="Password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button disabled={!password || isPending} onClick={() => onClick()}>
            Create
          </Button>
        </Flex>
      }
    />
  );
};

export const Admin = () => {
  const { data: accountFile, isLoading } = useQuery({
    queryKey: ["accountFile"],
    queryFn: async () => {
      const store = storeGetter.get(undefined);
      return (await readAccountFile(store)) ?? null;
    },
  });

  return (
    <>
      {isLoading ? (
        <Flex h="100%" justify={"center"} align={"center"}>
          <Loader color="blue" />;
        </Flex>
      ) : !accountFile ? (
        <AccountCreation />
      ) : (
        <AccountViewPage accountFile={accountFile} />
      )}
    </>
  );
};
