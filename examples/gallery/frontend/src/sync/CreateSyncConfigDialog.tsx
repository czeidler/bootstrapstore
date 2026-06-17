import { MetadataRepository } from "lib";
import { Flex, Modal, Select } from "@mantine/core";

import { SyncConfig } from "./SyncConfig";
import { PushConfig } from "./PushConfig";
import { useState } from "react";
import { SnapshotConfig } from "./SnapshotConfig";

export const CreateSyncConfigDialog = ({
  open,
  onClose,
  deviceId,
  metadataRepo,
}: {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
}) => {
  const [syncType, setSyncType] = useState<string | null>();
  return (
    <Modal opened={open} onClose={onClose}>
      <Flex direction={"column"} gap="xs">
        <Select
          label={"Sync Type"}
          data={[
            { value: "sync", label: "Sync" },
            { value: "push", label: "Push Repository" },
            { value: "snapshot", label: "Snapshot Directory" },
          ]}
          value={syncType}
          onChange={setSyncType}
        />
        {syncType === "sync" ? (
          <SyncConfig
            deviceId={deviceId}
            metadataRepo={metadataRepo}
            onClose={onClose}
          />
        ) : syncType === "push" ? (
          <PushConfig
            deviceId={deviceId}
            metadataRepo={metadataRepo}
            onClose={onClose}
          />
        ) : syncType === "snapshot" ? (
          <SnapshotConfig
            deviceId={deviceId}
            metadataRepo={metadataRepo}
            onClose={onClose}
          />
        ) : null}
      </Flex>
    </Modal>
  );
};
