import { Button, Stack, TextField, Typography } from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { AccountFile, Account } from "lib";
import { storeGetter } from "./utils";
import { useState } from "react";
import { SqlocalSerializableDB } from "./sqlite";
import { Repository } from "lib/src/repository";
import { FileBrowser } from "./FileBrowser";

// TEMP
function create16ByteBuffer(str: string): Buffer {
  const buffer = Buffer.alloc(16);
  Buffer.from(str).copy(buffer, 0, 0, 16);
  return buffer;
}

export const OpenAccount = ({ accountFile }: { accountFile: AccountFile }) => {
  const [password, setPassword] = useState<string | undefined>();
  const [account, setAccount] = useState<Account | undefined>();
  const [repo, setRepo] = useState<Repository>();

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
          {repo ? <FileBrowser repo={repo} /> : null}
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
