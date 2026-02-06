import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { MetadataRepository, VFSDir, VFSEntry } from "lib";
import { useEffect, useState } from "react";
import { useConnections, useUpsertConnection } from "./account-hooks";
import { ConnectionInfo } from "lib/src/main-repo";
import { trustedTsr } from "./tsr";
import { shortId } from "lib/src/utils";
import { useFileNavigation } from "./useFileNavigation";
import FileView from "./FileView";
import { RemoteProxyDirVFS } from "./remote-proxy-vfs";

const FileViewDialog = ({
  root,
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  root: VFSDir | undefined;
}) => {
  const { dirEntries, openFolder } = useFileNavigation(root);

  const onDirEntryClicked = async (entry: VFSEntry) => {
    if (entry.type !== "file") {
      await openFolder(entry.name);
      return;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      slotProps={{
        paper: {
          style: {
            height: "100%",
          },
        },
      }}
    >
      <DialogTitle id="alert-dialog-title">Files</DialogTitle>
      <DialogContent sx={{ pb: 0 }}>
        <FileView content={dirEntries} onDirEntryClicked={onDirEntryClicked} />
      </DialogContent>
      <DialogActions sx={{ pt: 0 }}>
        <Button onClick={onClose}>Ok</Button>
      </DialogActions>
    </Dialog>
  );
};

const CreateConnectionDialog = ({
  open,
  onClose,
  deviceId,
  metadataRepo,
}: {
  open: { connection?: ConnectionInfo } | undefined;
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
}) => {
  const [remote, setRemote] = useState<Partial<ConnectionInfo> | undefined>();

  useEffect(() => {
    if (remote === undefined) {
      setRemote(open?.connection);
    }
  }, [remote, open?.connection]);

  const { mutateAsync: upsertConnection } = useUpsertConnection(
    metadataRepo,
    deviceId,
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

export const RemoteTab = ({
  deviceId,
  metadataRepo,
}: {
  deviceId: string;
  metadataRepo: MetadataRepository;
}) => {
  const { data: connections } = useConnections(metadataRepo, deviceId);
  const [openCreateConnectionDialog, setOpenCreateConnectionDialog] = useState<
    { connection?: ConnectionInfo } | undefined
  >(undefined);

  const { mutate: ls } = trustedTsr.ls.useMutation();

  const [openDir, setOpenDir] = useState<RemoteProxyDirVFS | undefined>();

  return (
    <>
      <Stack height={"100%"}>
        <Stack direction={"row"}>
          <Button onClick={() => setOpenCreateConnectionDialog({})}>
            Add Connection
          </Button>
        </Stack>
        <Divider />
        <Typography>Connections</Typography>
        {connections?.map((it) => (
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
              onClick={() => setOpenCreateConnectionDialog({ connection: it })}
            >
              Edit Connection
            </Button>
            <Button onClick={() => setOpenDir(new RemoteProxyDirVFS(it, []))}>
              Browse
            </Button>
          </Stack>
        ))}
      </Stack>
      <FileViewDialog
        root={openDir}
        open={openDir !== undefined}
        onClose={() => setOpenDir(undefined)}
      />
      <CreateConnectionDialog
        deviceId={deviceId}
        metadataRepo={metadataRepo}
        open={openCreateConnectionDialog}
        onClose={() => setOpenCreateConnectionDialog(undefined)}
      />
    </>
  );
};
