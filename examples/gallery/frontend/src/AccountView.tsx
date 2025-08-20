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
  Tooltip,
  Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { AccountFile, Account, MetadataRepository } from "lib";
import { storeGetter } from "./utils";
import { useEffect, useState } from "react";
import { AccountData } from "lib/src/account";
import { RemoteView } from "./RemoteView";
import { useCreateRemote, useProfiles } from "./account-hooks";
import { shortId } from "lib/src/utils";
import HomeTwoToneIcon from "@mui/icons-material/HomeTwoTone";
import { MainLayout } from "./MainLayout";
import { getRepoIOConfig } from "./io-config";

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
        getRepoIOConfig(),
        create16ByteBuffer(password),
        accountFile
      );

      const metadataRepo = await account.openMetadataRepo();
      onOpen(account.accountData, metadataRepo);
    },
  });

  return (
    <MainLayout
      Header={
        <Typography padding={0.5} variant="h5">
          Open Account
        </Typography>
      }
      Content={
        <>
          <TextField
            label="Password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button disabled={!password} onClick={() => openAccount()}>
            Open
          </Button>
        </>
      }
    />
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
  const { data: remotes } = useProfiles(metadataRepo);
  const [selectedRemote, setSelectedRemote] = useState<string | undefined>();
  useEffect(() => {
    setSelectedRemote(accountData?.profileId);
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
    <MainLayout
      Header={
        <>
          <Tooltip
            title={`Open: repo: ${accountData.repoId}, local remote: ${accountData.profileId}`}
          >
            <HomeTwoToneIcon sx={{ alignSelf: "center" }} />
          </Tooltip>
          <Typography padding={0.5} variant="h5">
            Account
          </Typography>
        </>
      }
      Content={
        <>
          <Stack direction={"row"} height={"100%"} marginRight={1}>
            <Stack justifyContent={"space-between"} minWidth="400px">
              <List
                subheader={
                  <ListSubheader sx={{ textAlign: "start" }}>
                    <Stack
                      paddingLeft={1}
                      direction={"row"}
                      justifyContent={"space-between"}
                      alignItems={"center"}
                    >
                      <Typography>Remotes:</Typography>
                      <Button onClick={() => setOpenAddRemoteDialog(true)}>
                        Add
                      </Button>
                    </Stack>
                  </ListSubheader>
                }
              >
                <Divider />
                <ListItem disablePadding={true} divider={true} dense={true}>
                  <ListItemButton
                    selected={selectedRemote === accountData.profileId}
                    onClick={() => setSelectedRemote(accountData.profileId)}
                  >
                    <ListItemText
                      primary={`${accountData.profileId} (Local)`}
                    />
                  </ListItemButton>
                </ListItem>
                {remotes
                  ?.filter((remote) => remote.id !== accountData.profileId)
                  .map((remote) => (
                    <ListItem
                      key={remote.id}
                      disablePadding={true}
                      divider={true}
                      dense={true}
                    >
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
            <Divider orientation="vertical" sx={{ marginRight: 1 }} />
            <RemoteView
              profileId={selectedRemote ?? accountData.profileId}
              metadataRepo={metadataRepo}
            />
          </Stack>
          <AddRemoteDialog
            open={openAddRemoteDialog}
            onClose={() => setOpenAddRemoteDialog(false)}
            metadataRepo={metadataRepo}
          />
        </>
      }
    />
  );
};
