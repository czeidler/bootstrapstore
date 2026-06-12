import { Button, Modal, Flex, Text, TextInput, Divider } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { MetadataRepository, shortId, SyncInfo } from "lib";
import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceWithLocations, useCreateSync, useSyncs } from "./account-hooks";
import { SyncDirStatus } from "./SyncDirStatus";
import { useMutation } from "@tanstack/react-query";
import { trustedTsr } from "./tsr";
import { SyncStatusSEEBodyType } from "../../backend/src/contract";

const CreateSyncDialog = ({
  open,
  onClose,
  deviceId,
  metadataRepo,
  init,
}: {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
  init?: SyncInfo;
}) => {
  const [from, setFrom] = useState(init?.type === "cp" ? init.from.path : "");
  const [to, setTo] = useState(init?.type === "cp" ? init.to.path : "");
  const { mutateAsync } = useCreateSync(metadataRepo, deviceId);
  const create = async () => {
    if (to === "" || from === "") {
      return;
    }
    await mutateAsync({
      id: init?.id ?? shortId(),
      type: "cp",
      from: { path: from },
      to: { path: to },
    });
    onClose();
  };
  return (
    <Modal opened={open} onClose={onClose}>
      <Flex direction={"column"} gap={10}>
        <Text id="alert-dialog-title">Copy</Text>
        <Flex direction={"column"}>
          <Text>From</Text>
          <TextInput
            value={from}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
          <Text>To</Text>
          <TextInput
            value={to}
            onChange={(event) => setTo(event.currentTarget.value)}
          />
        </Flex>
        <Flex gap={10} justify={"end"}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={create}
            autoFocus
            disabled={to === "" || from === ""}
          >
            Save
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
};

function useSyncStatus(syncId: string) {
  const [syncStatus, setSyncStatus] = useState<SyncStatusSEEBodyType | null>(
    null,
  );
  const eventSource = useRef<EventSource | null>(null);

  const recheck = useCallback(() => {
    eventSource.current?.close();

    const es = new EventSource(
      `http://localhost:8080/sync-status-events?syncId=${syncId}`,
    );
    eventSource.current = es;

    es.onmessage = (event: MessageEvent) => {
      console.log("Received event:", event.data);
      setSyncStatus(JSON.parse(event.data).event);
    };

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        console.log("EventSource closed by server");
      }
    };
  }, [syncId]);

  useEffect(() => {
    recheck();
    return () => {
      eventSource.current?.close();
      eventSource.current = null;
    };
  }, [recheck]);
  return { syncStatus, recheck };
}
export function SyncDirEntry({
  syncInfo,
  metadataRepo,
  deviceId,
}: {
  syncInfo: SyncInfo;
  metadataRepo: MetadataRepository;
  deviceId: string;
}) {
  const [openEditDialog, { toggle: toogleEdit, close: closeEdit }] =
    useDisclosure(false);
  const [openDryRunDialog, { toggle, close }] = useDisclosure(false);

  const { mutate: cpDir, isPending: isCopying } = useMutation({
    mutationFn: async () => {
      if (syncInfo.type !== "cp") {
        return;
      }

      const result = await trustedTsr.syncDir({
        body: {
          syncId: syncInfo.id,
          from: { path: syncInfo.from.path },
          to: { path: syncInfo.to.path },
        },
      });
      if (result.status !== 201) {
        throw Error(`HTTP status ${result.status}`);
      }
      return result.body;
    },
  });

  const { syncStatus, recheck } = useSyncStatus(syncInfo.id);
  const syncStatusText = !syncStatus
    ? undefined
    : syncStatus?.status === "error"
      ? syncStatus.error
      : syncStatus?.status === "ongoing"
        ? "Syncing..."
        : syncStatus?.status === "success"
          ? `Last synced at ${syncStatus.endTime}`
          : undefined;
  return (
    <>
      <Flex key={syncInfo.id} direction={"column"} gap={5} align={"start"}>
        <Text>Id: {syncInfo.id}</Text>
        <Text>Type: {syncInfo.type}</Text>
        {syncInfo.type === "cp" ? (
          <>
            <Text>From: {syncInfo.from.path}</Text>
            <Text>To: {syncInfo.to.path}</Text>
          </>
        ) : null}

        <Button onClick={toggle} disabled={isCopying}>
          Dry Run
        </Button>
        <Flex direction={"row"} align={"center"} gap={5}>
          <Button
            onClick={() => {
              cpDir();
              recheck();
            }}
            disabled={isCopying}
          >
            Run
          </Button>
          {syncStatusText ? <Text>{syncStatusText}</Text> : null}
        </Flex>
        <Button onClick={toogleEdit} disabled={isCopying}>
          Edit
        </Button>
      </Flex>
      {syncInfo.type === "cp" && (
        <Modal opened={openDryRunDialog} onClose={close} size={"80vw"}>
          <SyncDirStatus
            fromPath={syncInfo.from.path}
            toPath={syncInfo.to.path}
          />
        </Modal>
      )}
      {openEditDialog && (
        <CreateSyncDialog
          deviceId={deviceId}
          metadataRepo={metadataRepo}
          open={openEditDialog}
          init={syncInfo}
          onClose={closeEdit}
        />
      )}
    </>
  );
}

export function SyncDirView({
  metadataRepo,
  deviceId,
  devicesWithLocations,
}: {
  metadataRepo: MetadataRepository;
  deviceId: string;
  devicesWithLocations: DeviceWithLocations[] | undefined;
}) {
  const { data: syncs } = useSyncs(metadataRepo, deviceId);

  const [openCreateSyncDialog, { toggle, close }] = useDisclosure(false);
  return (
    <>
      <Flex h={"100%"} direction={"column"}>
        <Flex direction={"row"}>
          <Button onClick={toggle}>Add Sync</Button>
        </Flex>
        <Divider />
        <Text>Syncs</Text>
        {syncs?.map((it) => (
          <SyncDirEntry
            key={it.id}
            metadataRepo={metadataRepo}
            deviceId={deviceId}
            syncInfo={it}
          />
        ))}
      </Flex>
      <CreateSyncDialog
        deviceId={deviceId}
        metadataRepo={metadataRepo}
        open={openCreateSyncDialog}
        onClose={close}
      />
    </>
  );
}
