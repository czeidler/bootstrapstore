import { Button, Modal, Flex, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { MetadataRepository } from "lib";
import { useCallback, useEffect, useRef, useState } from "react";
import { SyncDirStatus } from "./SyncDirStatus";
import { useMutation } from "@tanstack/react-query";
import { trustedTsr } from "../tsr";
import { SyncStatusSEEBodyType } from "../../../backend/src/contract";
import { SyncEntryLayout } from "./SyncEntryLayout";
import { SyncPathInfo } from "lib/src/main-repo";
import { SyncConfig } from "./SyncConfig";

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
      isSyncing={isCopying}
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
