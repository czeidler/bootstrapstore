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
import { MetadataRepository } from "lib";
import { useEffect, useState } from "react";
import { FileBrowser } from "./FileBrowser";
import {
  useCheckouts,
  useConnections,
  useCreateCheckout,
  useCreateChildRepo,
  useCreateConnection,
  useRepositories,
} from "./account-hooks";
import { RemoteConnection, RepositoryInfo } from "lib/src/main-repo";
import { trustedTsr } from "./tsr";
import { shortId } from "lib/src/utils";

const CreateConnectionDialog = ({
  open,
  onClose,
  remoteId,
  metadataRepo,
}: {
  open: boolean;
  onClose: () => void;
  remoteId: string;
  metadataRepo: MetadataRepository;
}) => {
  const [connection, setConnection] = useState<RemoteConnection | undefined>();
  const [host, setHost] = useState<string | undefined>();
  const [user, setUser] = useState<string | undefined>();
  const [keyPem, setKeyPem] = useState<string | undefined>();
  useEffect(() => {
    if (host && user && keyPem) {
      setConnection({
        id: shortId(),
        type: "sftp",
        host,
        user,
        keyPem,
      } satisfies RemoteConnection);
    } else {
      setConnection(undefined);
    }
  }, [host, keyPem, user]);
  const { mutate: createConnection } = useCreateConnection(
    metadataRepo,
    remoteId
  );
  const create = async () => {
    if (connection) {
      await createConnection(connection);
    }
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle id="alert-dialog-title">Create sFTP Connection</DialogTitle>
      <DialogContent>
        <TextField
          value={host}
          autoFocus
          margin="dense"
          label="Host"
          fullWidth
          variant="standard"
          onChange={(event) => setHost(event.target.value)}
        />
        <TextField
          value={user}
          autoFocus
          margin="dense"
          label="User"
          fullWidth
          variant="standard"
          onChange={(event) => setUser(event.target.value)}
        />
        <TextField
          value={keyPem}
          autoFocus
          margin="dense"
          label="Key Pem"
          fullWidth
          variant="standard"
          onChange={(event) => setKeyPem(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={create} autoFocus disabled={connection === undefined}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const CreateRepoDialog = ({
  open,
  onClose,
  remoteId,
  metadataRepo,
}: {
  open: boolean;
  onClose: () => void;
  remoteId: string;
  metadataRepo: MetadataRepository;
}) => {
  const [repoName, setRepoName] = useState<string | undefined>();
  const { mutate: createChild } = useCreateChildRepo(
    metadataRepo,
    remoteId,
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
  remoteId,
  metadataRepo,
  repositories,
}: {
  open: boolean;
  onClose: () => void;
  remoteId: string;
  metadataRepo: MetadataRepository;
  repositories: RepositoryInfo[];
}) => {
  const [path, setPath] = useState<string | undefined>();
  const [repoId, setRepoId] = useState<string | null>(null);
  const { mutateAsync } = useCreateCheckout(metadataRepo, remoteId);
  const create = async () => {
    if (path === undefined || repoId === null) {
      return;
    }
    await mutateAsync({
      id: shortId(),
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

export const RemoteView = ({
  remoteId,
  metadataRepo,
}: {
  remoteId: string;
  metadataRepo: MetadataRepository;
}) => {
  const { data: connections } = useConnections(metadataRepo, remoteId);
  const { data: repositories } = useRepositories(metadataRepo, remoteId);
  const { data: checkouts } = useCheckouts(metadataRepo, remoteId);
  const [openCreateRepoDialog, setOpenCreateRepoDialog] = useState(false);
  const [openCreateCheckoutDialog, setOpenCreateCheckoutDialog] =
    useState(false);
  const [openCreateConnectionDialog, setOpenCreateConnectionDialog] =
    useState(false);

  const { mutateAsync: syncStatus } = trustedTsr.syncRepoStatus.useMutation();
  const { mutateAsync: sync } = trustedTsr.syncRepo.useMutation();

  return (
    <>
      <Stack>
        <Stack direction={"row"} alignItems={"center"}>
          <Typography>{`Remote: ${remoteId}`}</Typography>
          <Button>Details</Button>
        </Stack>
        <Stack direction={"row"}>
          <Button onClick={() => setOpenCreateConnectionDialog(true)}>
            Add Connection
          </Button>
          <Button onClick={() => setOpenCreateRepoDialog(true)}>
            Add Repo
          </Button>
          <Button onClick={() => setOpenCreateCheckoutDialog(true)}>
            Add Checkout
          </Button>
        </Stack>

        <Divider />
        <Typography>Connections</Typography>
        {connections?.map((it) => (
          <Stack flexDirection={"row"}>
            <Typography>Id: {it.id}</Typography>
            <Typography>Type: {it.type}</Typography>
          </Stack>
        ))}
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
        {checkouts?.map((it, i) => (
          <Stack key={`checkout_${i}`} flexDirection={"row"}>
            <Typography>Id: {it.id}</Typography>
            <Typography>Path: {it.path}</Typography>
            <Typography>
              Repo:{" "}
              {repositories?.find((r) => (r.id = it.repoId))?.name ?? it.repoId}
            </Typography>
            <Button
              onClick={async () => {
                const repo = repositories?.find(
                  (repo) => repo.id === it.repoId
                );
                if (repo === undefined) {
                  return;
                }
                const result = await syncStatus({
                  body: {
                    repoId: it.repoId,
                    encKey: repo.encKey,
                    checkoutPath: it.path,
                  },
                });
                console.log(result.body.changes);
              }}
            >
              Sync status
            </Button>
            <Button
              onClick={async () => {
                const repo = repositories?.find(
                  (repo) => repo.id === it.repoId
                );
                if (repo === undefined) {
                  return;
                }
                const result = await sync({
                  body: {
                    repoId: it.repoId,
                    encKey: repo.encKey,
                    checkoutPath: it.path,
                  },
                });
                console.log(result);
              }}
            >
              Sync
            </Button>
          </Stack>
        ))}
        <Divider />
        <FileBrowser repo={metadataRepo.metaRepo} />
      </Stack>
      <CreateConnectionDialog
        remoteId={remoteId}
        metadataRepo={metadataRepo}
        open={openCreateConnectionDialog}
        onClose={() => setOpenCreateConnectionDialog(false)}
      />
      <CreateRepoDialog
        remoteId={remoteId}
        metadataRepo={metadataRepo}
        open={openCreateRepoDialog}
        onClose={() => setOpenCreateRepoDialog(false)}
      />
      <CreateCheckoutDialog
        remoteId={remoteId}
        metadataRepo={metadataRepo}
        open={openCreateCheckoutDialog}
        onClose={() => setOpenCreateCheckoutDialog(false)}
        repositories={repositories ?? []}
      />
    </>
  );
};
