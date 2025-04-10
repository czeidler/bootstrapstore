import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useEffect, useState } from "react";
import { SqlocalSerializableDB } from "./sqlite";
import { AccountData } from "lib/src/account";
import { RemoteView } from "./RemoteView";
import { useCreateRemote, useRemotes } from "./account-hooks";
import { shortId } from "lib/src/utils";

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

const AddRemoteDialog = ({
  open,
  onClose,
  metadataRepo,
}: {
  open: boolean;
  onClose: () => void;
  metadataRepo: MetadataRepository;
}) => {
  const [remoteName, setRemoteName] = useState<string | undefined>();
  const { mutateAsync } = useCreateRemote(metadataRepo);
  const create = async () => {
    await mutateAsync({
      id: shortId(),
      name: remoteName,
    });

    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle id="alert-dialog-title">Create Remote</DialogTitle>
      <DialogContent>
        <TextField
          value={remoteName}
          autoFocus
          margin="dense"
          id="name"
          name="reponame"
          label="Remote Name"
          fullWidth
          variant="standard"
          onChange={(event) => setRemoteName(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={create} autoFocus>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const AccountView = ({ accountFile }: { accountFile: AccountFile }) => {
  const [accountData, setAccountData] = useState<AccountData | undefined>();
  const [metadataRepo, setMetadataRepo] = useState<
    MetadataRepository | undefined
  >();

  const [openAddRemoteDialog, setOpenAddRemoteDialog] = useState(false);
  const { data: remotes } = useRemotes(metadataRepo);
  const [selectedRemote, setSelectedRemote] = useState<string | undefined>();
  useEffect(() => {
    setSelectedRemote(accountData?.remoteId);
  }, [accountData]);
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
    <>
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
                    Remotes:{" "}
                    <Button onClick={() => setOpenAddRemoteDialog(true)}>
                      Add
                    </Button>
                  </Stack>
                </ListSubheader>
              }
            >
              <ListItem>
                <ListItemButton
                  selected={selectedRemote === accountData.remoteId}
                  onClick={() => setSelectedRemote(accountData.remoteId)}
                >
                  <ListItemText primary={`${accountData.remoteId} (Local)`} />
                </ListItemButton>
              </ListItem>
              {remotes
                ?.filter((remote) => remote.id !== accountData.remoteId)
                .map((remote) => (
                  <ListItem>
                    <ListItemButton
                      selected={selectedRemote === remote.id}
                      onClick={() => setSelectedRemote(remote.id)}
                    >
                      <ListItemText primary={remote.name ?? remote.id} />
                    </ListItemButton>
                  </ListItem>
                ))}
            </List>
          </Stack>

          <RemoteView
            remoteId={selectedRemote ?? accountData.remoteId}
            metadataRepo={metadataRepo}
          />
        </Stack>
      </Stack>
      <AddRemoteDialog
        open={openAddRemoteDialog}
        onClose={() => setOpenAddRemoteDialog(false)}
        metadataRepo={metadataRepo}
      />
    </>
  );
};
