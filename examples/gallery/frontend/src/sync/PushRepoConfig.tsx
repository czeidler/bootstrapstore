import { Button, Modal, Flex, Text, TextInput, Select } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { MetadataRepository, shortId } from "lib";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCreateSync, useDevicesWithLocations } from "../account-hooks";
import { useMutation } from "@tanstack/react-query";
import { trustedTsr } from "../tsr";
import { SyncStatusSEEBodyType } from "../../../backend/src/contract";
import { AccountData } from "lib/src/account";
import { SyncPushRepoInfo } from "lib/src/main-repo";
import { SyncEntryLayout } from "./SyncEntryLayout";
import { SyncConfigLayout } from "./SyncConfigLayout";

export const PushRepoConfig = ({
  onClose,
  deviceId,
  metadataRepo,
  init,
}: {
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
  init?: SyncPushRepoInfo;
}) => {
  const [locationId, setLocationId] = useState(init?.locationId ?? null);
  const [to, setTo] = useState(init?.to.path ?? "");
  const { data: devicesWithLocations } = useDevicesWithLocations(metadataRepo);
  const localRepos = devicesWithLocations
    ?.find((it) => it.device.id === deviceId)
    ?.locations.filter((it) => it.type === "repository");
  const options = localRepos?.map((item) => ({
    value: item.id,
    label: item.name ?? item.id,
  }));

  const { mutateAsync } = useCreateSync(metadataRepo, deviceId);
  const save = async () => {
    if (to === "" || locationId === null) {
      return;
    }
    await mutateAsync({
      id: init?.id ?? shortId(),
      type: "push",
      locationId,
      to: { path: to },
    });
    onClose();
  };
  return (
    <SyncConfigLayout
      Content={
        <>
          <Select
            label="Repository"
            data={options}
            value={locationId}
            onChange={setLocationId}
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
      disabled={to === "" || locationId === null}
    />
  );
};

const EditPushRepoDialog = ({
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
  init: SyncPushRepoInfo;
}) => {
  return (
    <Modal opened={open} onClose={onClose}>
      <Flex direction={"column"} gap={10}>
        <Text id="alert-dialog-title">Snapshot</Text>
        <PushRepoConfig
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
export function PushRepoEntry({
  syncInfo,
  metadataRepo,
  deviceId,
  accountData,
}: {
  syncInfo: SyncPushRepoInfo;
  metadataRepo: MetadataRepository;
  deviceId: string;
  accountData: AccountData;
}) {
  const [openEditDialog, { toggle: toogleEdit, close: closeEdit }] =
    useDisclosure(false);
  const { mutate: syncRepo, isPending: isCopying } = useMutation({
    mutationFn: async () => {
      const fromLocation = await metadataRepo.readLocation(
        deviceId,
        syncInfo.locationId,
      );
      if (fromLocation?.type !== "repository") {
        throw Error("Expected repository location");
      }

      const inlined = accountData.repoId === fromLocation.id;
      const result = await trustedTsr.pushRepo({
        body: {
          repoId: syncInfo.id,
          encKey: fromLocation.encKey,
          from: { path: fromLocation.path, branch: "main", inlined },
          to: { path: syncInfo.to.path, branch: "main", inlined },
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
      title={"Push Repo"}
      isSyncing={isCopying}
      sync={async () => {
        syncRepo();
        recheck();
      }}
      actions={[
        <Button size={"xs"} onClick={toogleEdit} disabled={isCopying}>
          Edit
        </Button>,
      ]}
      Content={
        <>
          <Flex direction={"column"} gap={5} align={"start"}>
            <Text>From location: {syncInfo.locationId}</Text>
            <Text>To: {syncInfo.to.path}</Text>

            <Flex direction={"row"} align={"center"} gap={5}>
              {syncStatusText ? <Text>{syncStatusText}</Text> : null}
            </Flex>
          </Flex>

          {openEditDialog && (
            <EditPushRepoDialog
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
