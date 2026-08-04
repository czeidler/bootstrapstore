import { useMutation } from "@tanstack/react-query";
import { readAccountFile, Account } from "lib";
import { storeGetter } from "./utils";
import { useState } from "react";
import { AccountView } from "./AccountView";
import { MainLayout } from "./MainLayout";
import { getRepoIOConfig } from "./io-config";
import { queryClient } from "./account-hooks";
import {
  Button,
  Flex,
  PasswordInput,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { login, register } from "./opaque";
import { ref, useSnapshot } from "valtio";
import { authUserStore } from "./auth-store";

function errorNotification(message: string) {
  notifications.show({
    title: `Error`,
    message,
    color: "red",
  });
}

const LoginRegister = () => {
  const [tabValue, setTabValue] = useState<string>("login");

  const [userName, setUserName] = useState<string | undefined>();
  const [password, setPassword] = useState<string | undefined>();

  const { mutate: onRegister, isPending: registerPending } = useMutation({
    mutationFn: async () => {
      if (password === undefined || userName === undefined) {
        return;
      }
      const registerResult = await register(userName, password);
      if (registerResult === "UserExists") {
        errorNotification(`User already exists`);
        return;
      }
      const key = Buffer.from(registerResult.exportKey, "base64").subarray(
        0,
        16,
      );
      const loginResult = await login(userName, password);
      if (typeof loginResult === "string") {
        errorNotification(`Failed to login into just registered account`);
        return;
      }
      const auth = loginResult.auth;
      const store = storeGetter(auth).get(undefined);
      await Account.createAccount(
        store,
        storeGetter(auth),
        getRepoIOConfig(),
        key,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accountFile"] });
    },
    onError: (e) => errorNotification(`${e}`),
  });

  const { mutate: onLogin, isPending: loginPending } = useMutation({
    mutationFn: async () => {
      if (password === undefined || userName === undefined) {
        return;
      }
      const loginResponse = await login(userName, password);
      if (loginResponse === "NotFound") {
        errorNotification("User does not exist");
        return;
      }
      const key = Buffer.from(loginResponse.exportKey, "base64").subarray(
        0,
        16,
      );

      const auth = loginResponse.auth;
      const store = storeGetter(auth).get(undefined);
      const accountFile = await readAccountFile(store);
      if (accountFile === undefined) {
        errorNotification("Account file missing");
        return;
      }
      const account = await Account.openAccount(
        storeGetter(auth),
        getRepoIOConfig(),
        key,
        accountFile,
      );

      const metadataRepo = await account.openMetadataRepo();
      authUserStore.user = {
        auth,
        account,
        metadataRepo: ref(metadataRepo),
      };
    },
    onError: (e) => errorNotification(`${e}`),
  });

  const hasData = userName && password;
  const isPending = registerPending || loginPending;

  return (
    <MainLayout
      Header={<Text>Login</Text>}
      Content={
        <Flex style={{ alignSelf: "center" }}>
          <Tabs value={tabValue} onChange={(v) => setTabValue(v as string)}>
            <Tabs.List>
              <Tabs.Tab value="login">Login</Tabs.Tab>
              <Tabs.Tab value="register">Register</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="login">
              <Flex gap={"xs"} m={5} direction={"column"}>
                <TextInput
                  size="sm"
                  label="User Name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
                <PasswordInput
                  size="sm"
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <Button
                  disabled={!hasData || isPending}
                  onClick={() => onLogin()}
                >
                  Login
                </Button>
              </Flex>
            </Tabs.Panel>
            <Tabs.Panel value="register">
              <Flex gap={"xs"} m={5} direction={"column"}>
                <TextInput
                  size="sm"
                  label="User Name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
                <PasswordInput
                  size="sm"
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button
                  disabled={!hasData || isPending}
                  onClick={() => onRegister()}
                >
                  Register
                </Button>
              </Flex>
            </Tabs.Panel>
          </Tabs>
        </Flex>
      }
    />
  );
};

export const Admin = () => {
  const authUser = useSnapshot(authUserStore);
  if (authUserStore.user && authUser.user) {
    const accountData = authUser.user.account.accountData;
    return (
      <AccountView
        accountData={accountData}
        metadataRepo={authUserStore.user.metadataRepo}
        key={accountData.deviceId}
      />
    );
  }

  return <LoginRegister />;
};
