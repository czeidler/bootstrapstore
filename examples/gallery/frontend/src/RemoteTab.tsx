import { MetadataRepository, VFSDir, VFSEntry } from "lib";
import { useEffect, useState } from "react";
import { useConnections, useUpsertConnection } from "./account-hooks";
import { ConnectionInfo } from "lib/src/main-repo";
import { trustedTsr } from "./tsr";
import { shortId } from "lib/src/utils";
import { useFileNavigation } from "./useFileNavigation";
import FileView from "./FileView";
import { RemoteProxyDirVFS } from "./remote-proxy-vfs";
import { useMutation } from "@tanstack/react-query";
import { ClientInferRequest } from "@ts-rest/core";
import { trustedContract } from "../../backend/src/contract";
import {
  Button,
  Divider,
  Flex,
  Modal,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";

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
    <Modal title="Files" opened={open} onClose={onClose} maw="xl">
      <FileView content={dirEntries} onDirEntryClicked={onDirEntryClicked} />

      <Flex>
        <Button onClick={onClose}>Ok</Button>
      </Flex>
    </Modal>
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
    <Modal
      title="Create sFTP Connection"
      opened={open !== undefined}
      onClose={close}
    >
      {remote?.id !== undefined ? (
        <TextInput value={remote.id} autoFocus label="Id" disabled />
      ) : null}
      <TextInput
        value={remote?.host ?? ""}
        autoFocus
        label="Host"
        onChange={(event) =>
          setRemote((prev) => ({ ...prev, host: event.target.value }))
        }
      />
      <TextInput
        value={remote?.user ?? ""}
        autoFocus
        label="User"
        onChange={(event) =>
          setRemote((prev) => ({ ...prev, user: event.target.value }))
        }
      />
      <Textarea
        value={remote?.keyPem ?? ""}
        autoFocus
        label="Key Pem"
        onChange={(event) =>
          setRemote((prev) => ({ ...prev, keyPem: event.target.value }))
        }
      />

      <Flex mt={"xs"} gap="xs">
        <Button onClick={close}>Cancel</Button>
        <Button onClick={create} autoFocus disabled={remote === undefined}>
          {remote?.id !== undefined ? "Save" : "Create"}
        </Button>
      </Flex>
    </Modal>
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

  const { mutateAsync: ls } = useMutation({
    mutationFn: async (
      params: ClientInferRequest<typeof trustedContract.ls>,
    ) => {
      return trustedTsr.ls(params);
    },
  });

  const [openDir, setOpenDir] = useState<RemoteProxyDirVFS | undefined>();

  return (
    <>
      <Flex direction="column" h={"100%"}>
        <Flex direction={"row"}>
          <Button size="xs" onClick={() => setOpenCreateConnectionDialog({})}>
            Add Connection
          </Button>
        </Flex>
        <Divider />
        <Text>Connections</Text>
        {connections?.map((it) => (
          <Flex key={it.id} direction={"row"}>
            <Text>Id: {it.id}</Text>
            <Text>Type: {it.type}</Text>
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
          </Flex>
        ))}
      </Flex>
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
