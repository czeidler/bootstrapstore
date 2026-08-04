import { useCallback, useEffect, useRef, useState } from "react";
import { MetadataRepository, shortId } from "lib";
import { useCreateSync } from "../account-hooks";
import { Button, Flex, Modal, Text, TextInput } from "@mantine/core";
import { SyncConfigLayout } from "./SyncConfigLayout";
import { SyncPathInfo } from "lib/src/main-repo";
import { SyncEntryLayout } from "./SyncEntryLayout";
import { SyncDirStatus } from "./SyncDirStatus";
import { useDisclosure } from "@mantine/hooks";
import { useMutation } from "@tanstack/react-query";
import { trustedTsr } from "../tsr";
import { SyncStatusSEEBodyType } from "../../../backend/src/contract";

export const SyncConfig = ({
  onClose,
  deviceId,
  metadataRepo,
  init,
}: {
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
  init?: SyncPathInfo;
}) => {
  const [from, setFrom] = useState(init?.from.path ?? "");
  const [to, setTo] = useState(init?.to.path ?? "");
  const { mutateAsync } = useCreateSync(metadataRepo, deviceId);
  const save = async () => {
    if (to === "" || from === "") {
      return;
    }
    await mutateAsync({
      id: init?.id ?? shortId(),
      type: "sync",
      from: { path: from },
      to: { path: to },
    });
    onClose();
  };
  return (
    <SyncConfigLayout
      Content={
        <>
          <TextInput
            label="From"
            value={from}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
          <TextInput
            label="To"
            value={to}
            onChange={(event) => setTo(event.currentTarget.value)}
          />
        </>
      }
      onClose={onClose}
      save={save}
      disabled={to === "" || from === ""}
    />
  );
};

const EditSyncDialog = ({
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
  init: SyncPathInfo;
}) => {
  return (
    <Modal opened={open} onClose={onClose}>
      <Flex direction={"column"} gap={10}>
        <Text id="alert-dialog-title">Copy</Text>
        <SyncConfig
          onClose={onClose}
          deviceId={deviceId}
          metadataRepo={metadataRepo}
          init={init}
        />
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

export function SyncEntry({
  syncInfo,
  metadataRepo,
  deviceId,
}: {
  syncInfo: SyncPathInfo;
  metadataRepo: MetadataRepository;
  deviceId: string;
}) {
  const [openEditDialog, { toggle: toogleEdit, close: closeEdit }] =
    useDisclosure(false);
  const [openDryRunDialog, { toggle, close }] = useDisclosure(false);

  const { mutate: cpDir, isPending: isCopying } = useMutation({
    mutationFn: async () => {
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
    <SyncEntryLayout
      key={syncInfo.id}
      id={syncInfo.id}
      title={"Sync"}
      disabled={isCopying}
      sync={async () => {
        cpDir();
        recheck();
      }}
      actions={[
        <Button onClick={toggle} disabled={isCopying} size="xs">
          Dry Run
        </Button>,

        <Button onClick={toogleEdit} disabled={isCopying} size="xs">
          Edit
        </Button>,
      ]}
      Content={
        <>
          <Flex direction={"column"} gap={5} align={"start"}>
            <Text>From: {syncInfo.from.path}</Text>
            <Text>To: {syncInfo.to.path}</Text>
            <Flex direction={"row"} align={"center"} gap={5}>
              {syncStatusText ? <Text>{syncStatusText}</Text> : null}
            </Flex>
          </Flex>

          <Modal opened={openDryRunDialog} onClose={close} size={"80vw"}>
            <SyncDirStatus
              fromPath={syncInfo.from.path}
              toPath={syncInfo.to.path}
            />
          </Modal>

          {openEditDialog && (
            <EditSyncDialog
              deviceId={deviceId}
              metadataRepo={metadataRepo}
              open={openEditDialog}
              init={syncInfo}
              onClose={closeEdit}
            />
          )}
        </>
      }
    />
  );
}
