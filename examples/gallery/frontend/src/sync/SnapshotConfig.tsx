import { useState } from "react";
import { MetadataRepository, shortId } from "lib";
import { useCreateSync, useDevicesWithLocations } from "../account-hooks";
import { Button, Flex, Modal, Select, Text, TextInput } from "@mantine/core";
import { SyncConfigLayout } from "./SyncConfigLayout";
import { SnapshotInfo } from "lib/src/main-repo";
import { SyncEntryLayout } from "./SyncEntryLayout";
import { useDisclosure } from "@mantine/hooks";
import { useMutation } from "@tanstack/react-query";
import { trustedTsr } from "../tsr";

export const SnapshotConfig = ({
  onClose,
  deviceId,
  metadataRepo,
  init,
}: {
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
  init?: SnapshotInfo;
}) => {
  const [locationId, setLocationId] = useState(init?.locationId ?? null);
  const [from, setFrom] = useState(init?.from.path ?? "");
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
    if (from === "" || locationId === null) {
      return;
    }
    await mutateAsync({
      id: init?.id ?? shortId(),
      type: "snapshot",
      locationId: locationId,
      from: { path: from },
    });
    onClose();
  };
  return (
    <SyncConfigLayout
      Content={
        <>
          <TextInput
            label="Source"
            value={from}
            onChange={(event) => setFrom(event.currentTarget.value)}
          />
          <Select
            label="Repository"
            data={options}
            value={locationId}
            onChange={setLocationId}
          />
        </>
      }
      onClose={onClose}
      save={save}
      disabled={from === "" || locationId === null}
    />
  );
};

const EditSnapshotDialog = ({
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
  init: SnapshotInfo;
}) => {
  return (
    <Modal opened={open} onClose={onClose}>
      <Flex direction={"column"} gap={10}>
        <Text id="alert-dialog-title">Snapshot</Text>
        <SnapshotConfig
          onClose={onClose}
          deviceId={deviceId}
          metadataRepo={metadataRepo}
          init={init}
        />
      </Flex>
    </Modal>
  );
};

export function SnapshotEntry({
  syncInfo,
  metadataRepo,
  deviceId,
}: {
  syncInfo: SnapshotInfo;
  metadataRepo: MetadataRepository;
  deviceId: string;
}) {
  const [openEditDialog, { toggle: toggleEdit, close: closeEdit }] =
    useDisclosure(false);
  const { mutate: snapshot, isPending: isCopying } = useMutation({
    mutationFn: async () => {
      const fromLocation = await metadataRepo.readLocation(
        deviceId,
        syncInfo.locationId,
      );
      if (fromLocation?.type !== "repository") {
        throw Error("Expected repository location");
      }

      const result = await trustedTsr.snapshotCheckout({
        body: {
          repoId: fromLocation.repoId,
          encKey: fromLocation.encKey,
          checkoutPath: syncInfo.from.path,
        },
      });
      if (result.status !== 201) {
        throw Error(`HTTP status ${result.status}`);
      }
      return result.body;
    },
  });

  return (
    <SyncEntryLayout
      key={syncInfo.id}
      id={syncInfo.id}
      title={"Snapshot Directory"}
      disabled={isCopying}
      sync={async () => {
        snapshot();
      }}
      actions={[
        <Button size={"xs"} onClick={toggleEdit} disabled={isCopying}>
          Edit
        </Button>,
      ]}
      Content={
        <>
          <Flex direction={"column"} gap={5} align={"start"}>
            <Text>From: {syncInfo.from.path}</Text>
            <Text>Target Repo: {syncInfo.locationId} (location id)</Text>
          </Flex>

          {openEditDialog && (
            <EditSnapshotDialog
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
