import {
  Button,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { AccountFile, Account, MetadataRepository } from "lib";
import { storeGetter } from "./utils";
import { useState } from "react";
import { SqlocalSerializableDB } from "./sqlite";
import { AccountData } from "lib/src/account";
import { RemoteView } from "./RemoteView";

// TEMP
function create16ByteBuffer(str: string): Buffer {
  const buffer = Buffer.alloc(16);
  Buffer.from(str).copy(buffer, 0, 0, 16);
  return buffer;
}

const OpenAccount = ({
  onOpen,
  accountFile,
}: {
  onOpen: (accountData: AccountData, metadataRepo: MetadataRepository) => void;
  accountFile: AccountFile;
}) => {
  const [password, setPassword] = useState<string | undefined>();

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

      const metadataRepo = await account.openMetadataRepo();
      onOpen(account.accountData, metadataRepo);
    },
  });

  return (
    <>
      <Typography>Open Account</Typography>
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

export const AccountView = ({ accountFile }: { accountFile: AccountFile }) => {
  const [accountData, setAccountData] = useState<AccountData | undefined>();
  const [metadataRepo, setMetadataRepo] = useState<
    MetadataRepository | undefined
  >();

  if (accountData === undefined || metadataRepo === undefined) {
    return (
      <OpenAccount
        accountFile={accountFile}
        onOpen={(accountData, metadataRepo) => {
          setAccountData(accountData);
          setMetadataRepo(metadataRepo);
        }}
      />
    );
  }

  return (
    <Stack height={"100%"}>
      <Typography
        alignSelf={"start"}
      >{`Open: repo: ${accountData.repoId}, local remote: ${accountData.remoteId}`}</Typography>
      <Divider />
      <Stack direction={"row"} height={"100%"}>
        <Stack justifyContent={"space-between"}>
          <List
            subheader={
              <ListSubheader sx={{ textAlign: "start" }}>
                <Stack direction={"row"} justifyContent={"space-between"}>
                  Remotes: <Button>Add</Button>
                </Stack>
              </ListSubheader>
            }
          >
            <ListItem>
              <ListItemButton selected={true}>
                <ListItemText primary={accountData.remoteId} />
              </ListItemButton>
            </ListItem>
          </List>
        </Stack>

        <RemoteView
          remoteId={accountData.remoteId}
          metadataRepo={metadataRepo}
        />
      </Stack>
    </Stack>
  );
};
