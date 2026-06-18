import { Button, Modal, Flex, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { MetadataRepository } from "lib";
import { useMutation } from "@tanstack/react-query";
import { trustedTsr } from "../tsr";
import { SnapshotInfo } from "lib/src/main-repo";
import { SyncEntryLayout } from "./SyncEntryLayout";
import { SnapshotConfig } from "./SnapshotConfig";

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
      isSyncing={isCopying}
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
            <Text>Location id: {syncInfo.locationId}</Text>
            <Text>From: {syncInfo.from.path}</Text>
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
