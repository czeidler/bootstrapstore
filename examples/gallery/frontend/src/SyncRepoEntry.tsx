import { Button, Modal, Flex, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { MetadataRepository, shortId, SyncInfo } from "lib";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCreateSync } from "./account-hooks";
import { useMutation } from "@tanstack/react-query";
import { trustedTsr } from "./tsr";
import { SyncStatusSEEBodyType } from "../../backend/src/contract";
import { AccountData } from "lib/src/account";
import { SyncPushRepoInfo } from "lib/src/main-repo";

const CreateSyncRepoDialog = ({
  open,
  onClose,
  deviceId,
  repoId,
  metadataRepo,
  init,
}: {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  repoId: string;
  metadataRepo: MetadataRepository;
  init?: SyncInfo;
}) => {
  const [to, setTo] = useState(init?.type === "push" ? init.to.path : "");
  const { mutateAsync } = useCreateSync(metadataRepo, deviceId);
  const create = async () => {
    if (to === "") {
      return;
    }
    await mutateAsync({
      id: init?.id ?? shortId(),
      type: "push",
      repoId,
      to: { path: to },
    });
    onClose();
  };
  return (
    <Modal opened={open} onClose={onClose}>
      <Flex direction={"column"} gap={10}>
        <Text id="alert-dialog-title">Push Repo</Text>
        <Flex direction={"column"}>
          <Text>To</Text>
          <TextInput
            value={to}
            onChange={(event) => setTo(event.currentTarget.value)}
          />
        </Flex>
        <Flex gap={10} justify={"end"}>
          <Button onClick={onClose}>Cancel</Button>
          <Button onClick={create} autoFocus disabled={to === ""}>
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
export function SyncRepoEntry({
  syncInfo,
  metadataRepo,
  deviceId,
  repoId,
  accountData,
}: {
  syncInfo: SyncPushRepoInfo;
  metadataRepo: MetadataRepository;
  deviceId: string;
  repoId: string;
  accountData: AccountData;
}) {
  const [openEditDialog, { toggle: toogleEdit, close: closeEdit }] =
    useDisclosure(false);
  const { mutate: syncRepo, isPending: isCopying } = useMutation({
    mutationFn: async () => {
      const fromLocation = await metadataRepo.readLocation(deviceId, repoId);
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
    <>
      <Flex key={syncInfo.id} direction={"column"} gap={5} align={"start"}>
        <Text>Id: {syncInfo.id}</Text>
        <Text>Type: {syncInfo.type}</Text>
        {syncInfo.type === "push" ? (
          <>
            <Text>To: {syncInfo.to.path}</Text>
          </>
        ) : null}

        <Flex direction={"row"} align={"center"} gap={5}>
          <Button
            onClick={() => {
              syncRepo();
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

      {openEditDialog && (
        <CreateSyncRepoDialog
          deviceId={deviceId}
          repoId={repoId}
          metadataRepo={metadataRepo}
          open={openEditDialog}
          init={syncInfo}
          onClose={closeEdit}
        />
      )}
    </>
  );
}
