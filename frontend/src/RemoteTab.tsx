import { MetadataRepository, VFSDir, VFSEntry } from "lib";
import { ReactNode, useEffect, useState } from "react";
import { useConnections, useUpsertConnection } from "./account-hooks";
import { BootstrapConnectionInfo, SSHConnectionInfo } from "lib/src/main-repo";
import { trustedTsr } from "./tsr";
import { shortId } from "lib/src/utils";
import { useFileNavigation } from "./useFileNavigation";
import FileView from "./FileView";
import { RemoteProxyDirVFS } from "./remote-proxy-vfs";
import { useMutation } from "@tanstack/react-query";
import { ClientInferRequest } from "@ts-rest/core";
import {
  Button,
  Divider,
  Flex,
  Modal,
  Select,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { contractLocal } from "../../backend/src/contractLocal";

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

const ConnectionConfigLayout = ({
  Content,
  onClose,
  save,
  disabled,
}: {
  Content: ReactNode;
  onClose: () => void;
  save: () => Promise<void>;
  disabled: boolean;
}) => {
  return (
    <Flex h="100%" gap={"xs"} w={"100%"} direction={"column"}>
      {Content}
      <Flex gap={"xs"} justify={"end"}>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={save} autoFocus disabled={disabled}>
          Save
        </Button>
      </Flex>
    </Flex>
  );
};

const SSHConnectionConfig = ({
  open,
  onClose,
  deviceId,
  metadataRepo,
}: {
  open: { ssh?: SSHConnectionInfo } | undefined;
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
}) => {
  const [remote, setRemote] = useState<
    Partial<SSHConnectionInfo> | undefined
  >();

  useEffect(() => {
    if (remote === undefined) {
      setRemote(open?.ssh);
    }
  }, [remote, open?.ssh]);

  const { mutateAsync: upsertConnection } = useUpsertConnection(
    metadataRepo,
    deviceId,
  );
  const close = () => {
    setRemote(undefined);
    onClose();
  };
  const save = async () => {
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
    <ConnectionConfigLayout
      Content={
        <>
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
        </>
      }
      onClose={onClose}
      save={save}
      disabled={remote === undefined}
    />
  );
};

const BootstrapConnectionConfig = ({
  open,
  onClose,
  deviceId,
  metadataRepo,
}: {
  open: { bootstrap?: BootstrapConnectionInfo } | undefined;
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
}) => {
  const [remote, setRemote] = useState<
    Partial<BootstrapConnectionInfo> | undefined
  >();

  useEffect(() => {
    if (remote === undefined) {
      setRemote(open?.bootstrap);
    }
  }, [remote, open?.bootstrap]);

  const { mutateAsync: upsertConnection } = useUpsertConnection(
    metadataRepo,
    deviceId,
  );
  const close = () => {
    setRemote(undefined);
    onClose();
  };
  const save = async () => {
    if (remote === undefined) {
      return;
    }
    const { userName, password } = remote;
    if (userName !== undefined && password !== undefined) {
      await upsertConnection({
        id: remote.id ?? shortId(),
        type: "bootstrap",
        userName,
        password,
      });
    }
    close();
  };

  return (
    <ConnectionConfigLayout
      Content={
        <>
          {remote?.id !== undefined ? (
            <TextInput value={remote.id} autoFocus label="Id" disabled />
          ) : null}
          <TextInput
            value={remote?.userName ?? ""}
            autoFocus
            label="User name"
            onChange={(event) =>
              setRemote((prev) => ({ ...prev, host: event.target.value }))
            }
          />
          <TextInput
            value={remote?.password ?? ""}
            autoFocus
            label="Password"
            onChange={(event) =>
              setRemote((prev) => ({ ...prev, user: event.target.value }))
            }
          />
        </>
      }
      onClose={onClose}
      save={save}
      disabled={remote === undefined}
    />
  );
};

const CreateConnectionDialog = ({
  open,
  onClose,
  deviceId,
  metadataRepo,
}: {
  open:
    | { ssh?: SSHConnectionInfo; bootstrap?: BootstrapConnectionInfo }
    | undefined;
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
}) => {
  const [connectionType, setConnectionType] = useState<string | null>();

  return (
    <Modal
      title="Create Connection"
      opened={open !== undefined}
      onClose={close}
    >
      <Flex direction={"column"} gap="xs">
        <Select
          label={"Connection Type"}
          data={[
            { value: "ssh", label: "SSH" },
            { value: "bootstrap", label: "Bootstrap" },
          ]}
          value={connectionType}
          onChange={setConnectionType}
        />

        {connectionType === "ssh" && (
          <SSHConnectionConfig
            open={open}
            deviceId={deviceId}
            onClose={onClose}
            metadataRepo={metadataRepo}
          />
        )}
        {connectionType === "bootstrap" && (
          <BootstrapConnectionConfig
            open={open}
            deviceId={deviceId}
            onClose={onClose}
            metadataRepo={metadataRepo}
          />
        )}
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
    { ssh?: SSHConnectionInfo; bootstrap?: BootstrapConnectionInfo } | undefined
  >(undefined);

  const { mutateAsync: ls } = useMutation({
    mutationFn: async (params: ClientInferRequest<typeof contractLocal.ls>) => {
      return trustedTsr.ls(params);
    },
  });

  const [openDir, setOpenDir] = useState<RemoteProxyDirVFS | undefined>();

  return (
    <>
      <Flex direction="column" h={"100%"} gap="xs" mt={"xs"}>
        <Flex direction={"row"}>
          <Button size="xs" onClick={() => setOpenCreateConnectionDialog({})}>
            Add Connection
          </Button>
        </Flex>
        <Divider />
        <Text>Connections</Text>
        {connections?.map((it) => {
          if (it.type === "sftp") {
            return (
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
                  onClick={() =>
                    setOpenCreateConnectionDialog((prev) => ({
                      ...prev,
                      ssh: it,
                    }))
                  }
                >
                  Edit Connection
                </Button>
                <Button
                  onClick={() => setOpenDir(new RemoteProxyDirVFS(it, []))}
                >
                  Browse
                </Button>
              </Flex>
            );
          }
        })}
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
