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
  FormControl,
  InputLabel,
  Tabs,
  Tab,
} from "@mui/material";
import { MetadataRepository } from "lib";
import { useEffect, useState } from "react";
import {
  useLocations,
  useRemotes,
  useCreateCheckout,
  useCreateChildRepo,
  useUpsertRemote,
  useCreateSync,
  useSyncs,
} from "./account-hooks";
import {
  DirectoryLocationInfo,
  RemoteInfo,
  RepositoryLocationInfo,
} from "lib/src/main-repo";
import { trustedTsr } from "./tsr";
import { shortId } from "lib/src/utils";

const CreateConnectionDialog = ({
  open,
  onClose,
  profileId,
  metadataRepo,
}: {
  open: { remote?: RemoteInfo } | undefined;
  onClose: () => void;
  profileId: string;
  metadataRepo: MetadataRepository;
}) => {
  const [remote, setRemote] = useState<Partial<RemoteInfo> | undefined>();

  useEffect(() => {
    if (remote === undefined) {
      setRemote(open?.remote);
    }
  }, [remote, open?.remote]);

  const { mutateAsync: upsertConnection } = useUpsertRemote(
    metadataRepo,
    profileId
  );
  const close = () => {
    setRemote(undefined);
    onClose();
  };
  const create = async () => {
    if (remote === undefined) {
      return;
    }
    const { host, keyPem, user } = remote;
    if (host !== undefined && keyPem !== undefined && user !== undefined) {
      await upsertConnection({
        id: remote.id ?? shortId(),
        type: "sftp",
        host,
        keyPem,
        user,
      });
    }
    close();
  };
  return (
    <Dialog open={open !== undefined} onClose={close}>
      <DialogTitle id="alert-dialog-title">Create sFTP Connection</DialogTitle>
      <DialogContent>
        {remote?.id !== undefined ? (
          <TextField
            value={remote.id}
            autoFocus
            margin="dense"
            label="Id"
            fullWidth
            variant="standard"
            disabled
          />
        ) : null}
        <TextField
          value={remote?.host ?? ""}
          autoFocus
          margin="dense"
          label="Host"
          fullWidth
          variant="standard"
          onChange={(event) =>
            setRemote((prev) => ({ ...prev, host: event.target.value }))
          }
        />
        <TextField
          value={remote?.user ?? ""}
          autoFocus
          margin="dense"
          label="User"
          fullWidth
          variant="standard"
          onChange={(event) =>
            setRemote((prev) => ({ ...prev, user: event.target.value }))
          }
        />
        <TextField
          value={remote?.keyPem ?? ""}
          autoFocus
          margin="dense"
          label="Key Pem"
          fullWidth
          variant="standard"
          multiline={true}
          onChange={(event) =>
            setRemote((prev) => ({ ...prev, keyPem: event.target.value }))
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button onClick={create} autoFocus disabled={remote === undefined}>
          {remote?.id !== undefined ? "Save" : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const CreateRepoDialog = ({
  open,
  onClose,
  profileId,
  metadataRepo,
}: {
  open: boolean;
  onClose: () => void;
  profileId: string;
  metadataRepo: MetadataRepository;
}) => {
  const [repoName, setRepoName] = useState<string | undefined>();
  const { mutate: createChild } = useCreateChildRepo(
    metadataRepo,
    profileId,
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
  profileId,
  metadataRepo,
  repositories,
}: {
  open: boolean;
  onClose: () => void;
  profileId: string;
  metadataRepo: MetadataRepository;
  repositories: RepositoryLocationInfo[];
}) => {
  const [path, setPath] = useState<string | undefined>();
  const [repoId, setRepoId] = useState<string | null>(null);
  const { mutateAsync } = useCreateCheckout(metadataRepo, profileId);
  const close = () => {
    setPath(undefined);
    setRepoId(null);
    onClose();
  };
  const create = async () => {
    if (path === undefined || repoId === null) {
      return;
    }
    await mutateAsync({
      id: shortId(),
      type: "directory",
      path,
    });
    close();
  };
  return (
    <Dialog open={open} onClose={close}>
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
        <FormControl fullWidth>
          <InputLabel>Repository</InputLabel>
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
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button
          onClick={create}
          autoFocus
          disabled={path === undefined || repoId === null}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const SyncEntryCheckout = ({
  checkouts,
  checkoutId,
  setCheckoutId,
}: {
  checkouts: DirectoryLocationInfo[];
  checkoutId: string | undefined;
  setCheckoutId: (checkoutId: string) => void;
}) => {
  return (
    <FormControl fullWidth>
      <InputLabel>Checkout</InputLabel>
      <Select
        value={checkoutId}
        label="Checkout"
        onChange={(e) => setCheckoutId(e.target.value)}
      >
        {checkouts.map((checkout) => (
          <MenuItem key={checkout.id} value={checkout.id}>
            {checkout.path ?? checkout.id}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

const SyncEntryRepo = ({
  repositories,
  repoId,
  setRepoId,
}: {
  repositories: RepositoryLocationInfo[];
  repoId: string | null;
  setRepoId: (repoId: string | null) => void;
}) => {
  return (
    <FormControl fullWidth>
      <InputLabel>Repository</InputLabel>
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
    </FormControl>
  );
};

const CreateSyncDialog = ({
  open,
  onClose,
  profileId,
  metadataRepo,
  checkouts,
  repositories,
}: {
  open: boolean;
  onClose: () => void;
  profileId: string;
  metadataRepo: MetadataRepository;
  checkouts: DirectoryLocationInfo[];
  repositories: RepositoryLocationInfo[];
}) => {
  const [checkoutId, setCheckoutId] = useState<string | undefined>();
  const [repoId, setRepoId] = useState<string | null>(null);
  const { mutateAsync } = useCreateSync(metadataRepo, profileId);
  const create = async () => {
    if (checkoutId === undefined || repoId === null) {
      return;
    }
    await mutateAsync({
      id: shortId(),
      type: "repo",
      checkout: { id: checkoutId },
      repository: {
        id: repoId,
      },
    });
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle id="alert-dialog-title">Create Sync</DialogTitle>
      <DialogContent>
        <Typography>Entry 1</Typography>
        <SyncEntryCheckout
          checkouts={checkouts}
          checkoutId={checkoutId}
          setCheckoutId={setCheckoutId}
        />
        <Typography>Entry 2</Typography>
        <SyncEntryRepo
          repositories={repositories}
          repoId={repoId}
          setRepoId={setRepoId}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={create}
          autoFocus
          disabled={checkoutId === undefined || repoId === undefined}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const RemoteView = ({
  profileId,
  metadataRepo,
}: {
  profileId: string;
  metadataRepo: MetadataRepository;
}) => {
  const { data: remotes } = useRemotes(metadataRepo, profileId);
  const { data: locations } = useLocations(metadataRepo, profileId);
  const { data: syncs } = useSyncs(metadataRepo, profileId);
  const [openCreateRepoDialog, setOpenCreateRepoDialog] = useState(false);
  const [openCreateCheckoutDialog, setOpenCreateCheckoutDialog] =
    useState(false);
  const [openCreateRemoteDialog, setOpenCreateRemoteDialog] = useState<
    { remote?: RemoteInfo } | undefined
  >(undefined);
  const [openCreateSyncDialog, setOpenCreateSyncDialog] = useState(false);

  const { mutateAsync: syncStatus } = trustedTsr.syncRepoStatus.useMutation();
  const { mutateAsync: sync } = trustedTsr.syncRepo.useMutation();
  const { mutate: ls } = trustedTsr.ls.useMutation();
  type TabValue = "data" | "sync" | "remote";
  const [tabValue, setTabValue] = useState<TabValue>("data");

  const repositories = locations?.filter((it) => it.type === "repository");
  const checkouts = locations?.filter((it) => it.type === "directory");
  return (
    <>
      <Stack width="100%" height={"100%"}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab
            value={"data" satisfies TabValue}
            label="Data"
            sx={{ padding: "8px", minHeight: 0 }}
          />
          <Tab
            value={"sync" satisfies TabValue}
            label="Sync"
            sx={{ padding: "8px", minHeight: 0 }}
          />
          <Tab
            value={"remote" satisfies TabValue}
            label="Remote"
            sx={{ padding: "8px", minHeight: 0 }}
          />
        </Tabs>
        {tabValue === "data" ? (
          <Stack height={"100%"}>
            <Stack direction={"row"}>
              <Button onClick={() => setOpenCreateRepoDialog(true)}>
                Add Repo
              </Button>
              <Button onClick={() => setOpenCreateCheckoutDialog(true)}>
                Add Checkout
              </Button>
            </Stack>

            <Divider />
            <Typography>Repository</Typography>
            {repositories?.map((it) => (
              <Stack key={it.id} flexDirection={"row"}>
                <Typography>Id: {it.id}</Typography>
                <Typography>Name: {it.name}</Typography>
                <Typography>Path: {it.path}</Typography>
              </Stack>
            ))}
            <Divider />
            <Typography>Checkouts</Typography>
            {checkouts?.map((it, i) => (
              <Stack key={`checkout_${i}`} flexDirection={"row"}>
                <Typography>Id: {it.id}</Typography>
                <Typography>Path: {it.path}</Typography>
              </Stack>
            ))}
          </Stack>
        ) : null}
        {tabValue === "sync" ? (
          <Stack height={"100%"}>
            <Stack direction={"row"}>
              <Button onClick={() => setOpenCreateSyncDialog(true)}>
                Add Sync
              </Button>
            </Stack>
            <Divider />
            <Typography>Syncs</Typography>
            {syncs?.map((it) => (
              <Stack key={it.id} flexDirection={"row"}>
                <Typography>Id: {it.id}</Typography>
                <Typography>Type: {it.type}</Typography>
                {it.type === "repo" ? (
                  <>
                    <Typography>
                      Repo:{" "}
                      {repositories?.find(
                        (repo) => repo.id === it.repository.id
                      )?.name ??
                        repositories?.find(
                          (repo) => repo.id === it.repository.id
                        )?.id}
                    </Typography>
                    <Typography>
                      Checkout:{" "}
                      {checkouts?.find((c) => c.id === it.checkout.id)?.path}
                    </Typography>

                    <Button
                      onClick={async () => {
                        const repo = repositories?.find(
                          (repo) => repo.id === it.repository.id
                        );
                        if (repo === undefined) {
                          return;
                        }
                        const result = await syncStatus({
                          body: {
                            repoId: it.repository.id,
                            encKey: repo.encKey,
                            checkoutPath:
                              checkouts?.find((c) => c.id === it.checkout.id)
                                ?.path ?? "",
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
                          (repo) => repo.id === it.repository.id
                        );
                        if (repo === undefined) {
                          return;
                        }
                        const result = await sync({
                          body: {
                            repoId: it.repository.id,
                            encKey: repo.encKey,
                            checkoutPath:
                              checkouts?.find((c) => c.id === it.checkout.id)
                                ?.path ?? "",
                          },
                        });
                        console.log(result);
                      }}
                    >
                      Sync
                    </Button>
                  </>
                ) : null}
              </Stack>
            ))}
          </Stack>
        ) : null}
        {tabValue === "remote" ? (
          <Stack height={"100%"}>
            <Stack direction={"row"}>
              <Button onClick={() => setOpenCreateRemoteDialog({})}>
                Add Remote
              </Button>
            </Stack>
            <Divider />
            <Typography>Remotes</Typography>
            {remotes?.map((it) => (
              <Stack key={it.id} flexDirection={"row"}>
                <Typography>Id: {it.id}</Typography>
                <Typography>Type: {it.type}</Typography>
                <Button
                  onClick={() =>
                    ls({
                      body: {
                        remote: {
                          type: it.type,
                          host: it.host,
                          user: it.user,
                          keyPem: it.keyPem,
                        },
                        path: "",
                      },
                    })
                  }
                >
                  RClone test
                </Button>
                <Button
                  onClick={() => setOpenCreateRemoteDialog({ remote: it })}
                >
                  Edit Connection
                </Button>
              </Stack>
            ))}
          </Stack>
        ) : null}
      </Stack>
      <CreateConnectionDialog
        profileId={profileId}
        metadataRepo={metadataRepo}
        open={openCreateRemoteDialog}
        onClose={() => setOpenCreateRemoteDialog(undefined)}
      />
      <CreateRepoDialog
        profileId={profileId}
        metadataRepo={metadataRepo}
        open={openCreateRepoDialog}
        onClose={() => setOpenCreateRepoDialog(false)}
      />
      <CreateCheckoutDialog
        profileId={profileId}
        metadataRepo={metadataRepo}
        open={openCreateCheckoutDialog}
        onClose={() => setOpenCreateCheckoutDialog(false)}
        repositories={repositories ?? []}
      />
      <CreateSyncDialog
        profileId={profileId}
        metadataRepo={metadataRepo}
        open={openCreateSyncDialog}
        onClose={() => setOpenCreateSyncDialog(false)}
        checkouts={checkouts ?? []}
        repositories={repositories ?? []}
      />
    </>
  );
};
