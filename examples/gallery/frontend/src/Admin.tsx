import {
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery } from "@tanstack/react-query";
import { readAccountFile, AccountFile, Account } from "lib";
import { storeGetter } from "./utils";
import { useState } from "react";
import { SqlocalSerializableDB } from "./sqlite";
import FileViewer from "./FileViewer";
import { Repository } from "lib/src/repository";
import { useFileNavigation } from "./useFileNavigation";

// TEMP
function create16ByteBuffer(str: string): Buffer {
  const buffer = Buffer.alloc(16);
  Buffer.from(str).copy(buffer, 0, 0, 16);
  return buffer;
}

const AccountCreation = () => {
  const [password, setPassword] = useState<string | undefined>();
  const { mutate: onClick } = useMutation({
    mutationFn: async () => {
      if (password === undefined) {
        return;
      }
      const store = storeGetter.get(undefined);
      Account.createAccount(
        store,
        storeGetter,
        SqlocalSerializableDB,
        create16ByteBuffer(password)
      );
    },
  });
  return (
    <>
      <Typography>Create Account</Typography>
      <TextField
        label="Password"
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button disabled={!password} onClick={() => onClick()}>
        Create
      </Button>
    </>
  );
};

const AccountView = ({ accountFile }: { accountFile: AccountFile }) => {
  const [password, setPassword] = useState<string | undefined>();
  const [account, setAccount] = useState<Account | undefined>();
  const [repo, setRepo] = useState<Repository>();
  const { dirEntries, openFolder } = useFileNavigation(repo, storeGetter);

  const { mutate: openAccount } = useMutation({
    mutationFn: async () => {
      if (password === undefined) {
        return;
      }
      const account = await Account.openAccount(
        storeGetter,
        SqlocalSerializableDB,
        create16ByteBuffer(password),
        accountFile
      );
      setAccount(account);

      const mainRepo = await account.openRepository({
        key: Buffer.from(account.accountData.repoKeyBase64, "base64"),
        branch: ".metadata",
        inlined: true,
      });
      setRepo(mainRepo);
    },
  });

  return (
    <>
      <Typography>Open Account</Typography>
      {account ? (
        <Stack>
          <Typography>{`Open: repo: ${account.accountData.repoId}, remote: ${account.accountData.remoteId}`}</Typography>
          {repo ? (
            <FileViewer content={dirEntries} openFolder={openFolder} />
          ) : null}
        </Stack>
      ) : null}
      <TextField
        label="Password"
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button disabled={!password} onClick={() => openAccount()}>
        Open
      </Button>
    </>
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
    <Stack height="100%">
      <Typography>Admin</Typography>

      {isLoading ? (
        <Stack height="100%" justifyContent={"center"} alignItems={"center"}>
          <CircularProgress />
        </Stack>
      ) : !accountFile ? (
        <AccountCreation />
      ) : (
        <AccountView accountFile={accountFile} />
      )}
    </Stack>
  );
};
