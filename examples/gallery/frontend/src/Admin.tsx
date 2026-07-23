import { useMutation, useQuery } from "@tanstack/react-query";
import { readAccountFile, Account } from "lib";
import { storeGetter } from "./utils";
import { useState } from "react";
import { AccountViewPage } from "./AccountView";
import { MainLayout } from "./MainLayout";
import { getRepoIOConfig } from "./io-config";
import { queryClient } from "./account-hooks";
import {
  Button,
  Flex,
  Loader,
  PasswordInput,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { register } from "./opaque";

const AccountCreation = () => {
  const [userName, setUserName] = useState<string | undefined>();
  const [password, setPassword] = useState<string | undefined>();
  const { mutate: onClick, isPending } = useMutation({
    mutationFn: async () => {
      if (password === undefined || userName === undefined) {
        return;
      }
      const { exportKey } = await register(userName, password);
      const key = Buffer.from(exportKey, "base64").subarray(0, 16);
      const store = storeGetter.get(undefined);
      await Account.createAccount(store, storeGetter, getRepoIOConfig(), key);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accountFile"] });
    },
    onError: (e) => {
      notifications.show({
        title: `Error`,
        message: `${e}`,
        color: "red",
      });
    },
  });
  return (
    <MainLayout
      Header={<Text>Create Account</Text>}
      Content={
        <Flex gap={"xs"} m={5} direction={"column"}>
          <TextInput
            size="sm"
            label="User Name"
            onChange={(e) => setUserName(e.target.value)}
          />
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
