import { Button, Modal, Flex, Text, TextInput, Select } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { MetadataRepository, shortId } from "lib";
import { useState } from "react";
import { useCreateSync, useDevicesWithLocations } from "../account-hooks";
import { useMutation } from "@tanstack/react-query";
import { trustedClient } from "../client";
import { AccountData } from "lib/src/account";
import { SyncPushRepoInfo } from "lib/src/main-repo";
import { SyncEntryLayout } from "./SyncEntryLayout";
import { SyncConfigLayout } from "./SyncConfigLayout";
import { useSnapshot } from "valtio";
import { authUserStore } from "../auth-store";
import { useSyncStatus } from "./useSyncStatus";

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
  const authUser = useSnapshot(authUserStore);
  const [openEditDialog, { toggle: toggleEdit, close: closeEdit }] =
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
      if (authUser.user?.auth === undefined) {
        throw Error("No auth user");
      }

      const inlined = accountData.repoId === fromLocation.id;
      const result = await trustedClient.pushRepo({
        auth: authUser.user.auth,
        repoId: fromLocation.repoId,
        encKey: fromLocation.encKey,
        from: { path: fromLocation.path, branch: "main", inlined },
        to: { path: syncInfo.to.path, branch: "main", inlined },
      });
      return result;
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
      disabled={isCopying}
      sync={async () => {
        syncRepo();
        recheck();
      }}
      actions={[
        <Button size={"xs"} onClick={toggleEdit} disabled={isCopying}>
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
