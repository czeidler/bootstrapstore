import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation } from "@tanstack/react-query";
import { AccountFile, Account, MetadataRepository } from "lib";
import { storeGetter } from "./utils";
import { useState } from "react";
import { SqlocalSerializableDB } from "./sqlite";
import { FileBrowser } from "./FileBrowser";
import { AccountData } from "lib/src/account";
import {
  useCheckouts,
  useCreateCheckout,
  useCreateChildRepo,
  useRepositories,
} from "./account-hooks";
import { RepositoryInfo } from "lib/src/main-repo";
import { arrayToHex } from "lib/src/utils";

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

const CreateRepoDialog = ({
  open,
  onClose,
  accountData,
  metadataRepo,
}: {
  open: boolean;
  onClose: () => void;
  accountData: AccountData;
  metadataRepo: MetadataRepository;
}) => {
  const [repoName, setRepoName] = useState<string | undefined>();
  const { mutate: createChild } = useCreateChildRepo(
    metadataRepo,
    accountData.remoteId,
    repoName
  );
  const create = async () => {
    await createChild();
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle id="alert-dialog-title">Create Repository</DialogTitle>
      <DialogContent>
        <TextField
          value={repoName}
          autoFocus
          margin="dense"
          id="name"
          name="reponame"
          label="Repository Name"
          fullWidth
          variant="standard"
          onChange={(event) => setRepoName(event.target.value)}
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

const CreateCheckoutDialog = ({
  open,
  onClose,
  accountData,
  metadataRepo,
  repositories,
}: {
  open: boolean;
  onClose: () => void;
  accountData: AccountData;
  metadataRepo: MetadataRepository;
  repositories: RepositoryInfo[];
}) => {
  const [path, setPath] = useState<string | undefined>();
  const [repoId, setRepoId] = useState<string | null>(null);
  const { mutateAsync } = useCreateCheckout(metadataRepo, accountData.remoteId);
  const create = async () => {
    if (path === undefined || repoId === null) {
      return;
    }
    await mutateAsync({
      id: arrayToHex(crypto.getRandomValues(new Uint8Array(12))),
      type: "repo",
      path,
      repoId,
    });
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle id="alert-dialog-title">Create Checkout</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          id="name"
          name="checkoutpath"
          value={path}
          label="Checkout Path"
          fullWidth
          variant="standard"
          onChange={(event) => setPath(event.target.value)}
        />
        <Select
          value={repoId}
          label="Repository"
          onChange={(e) => setRepoId(e.target.value)}
        >
          {repositories.map((repo) => (
            <MenuItem key={repo.id} value={repo.id}>
              {repo.name ?? repo.id}
            </MenuItem>
          ))}
        </Select>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={create}
          autoFocus
          disabled={path === undefined || repoId === undefined}
        >
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
  const { data: repositories } = useRepositories(metadataRepo, accountData);
  const { data: checkouts } = useCheckouts(metadataRepo, accountData);
  const [openCreateRepoDialog, setOpenCreateRepoDialog] = useState(false);
  const [openCreateCheckoutDialog, setOpenCreateCheckoutDialog] =
    useState(false);

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
      <Stack>
        <Typography>{`Open: repo: ${accountData.repoId}, remote: ${accountData.remoteId}`}</Typography>
        <Button onClick={() => setOpenCreateRepoDialog(true)}>Add Repo</Button>
        <Button onClick={() => setOpenCreateCheckoutDialog(true)}>
          Add Checkout
        </Button>
        <Divider />
        <Typography>Repository</Typography>
        {repositories?.map((it) => (
          <Stack flexDirection={"row"}>
            <Typography>Id: {it.id}</Typography>
            <Typography>Name: {it.name}</Typography>
          </Stack>
        ))}
        <Divider />
        <Typography>Checkouts</Typography>
        {checkouts?.map((it) => (
          <Stack flexDirection={"row"}>
            <Typography>Id: {it.id}</Typography>
            <Typography>Path: {it.path}</Typography>
            <Typography>Repo: {it.repoId}</Typography>
          </Stack>
        ))}
        <Divider />
        <FileBrowser repo={metadataRepo.metaRepo} />
      </Stack>
      <CreateRepoDialog
        accountData={accountData}
        metadataRepo={metadataRepo}
        open={openCreateRepoDialog}
        onClose={() => setOpenCreateRepoDialog(false)}
      />
      <CreateCheckoutDialog
        accountData={accountData}
        metadataRepo={metadataRepo}
        open={openCreateCheckoutDialog}
        onClose={() => setOpenCreateCheckoutDialog(false)}
        repositories={repositories ?? []}
      />
    </>
  );
};
