import { Flex, Modal, Select } from "@mantine/core";
import { MetadataRepository } from "lib";
import { useState } from "react";
import { RepositoryConfig } from "./RepositoryLocation";

export const CreateLocationDialog = ({
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
  const [locationType, setLocationType] = useState<string | null>();
  return (
    <Modal title={"Add Location"} opened={open} onClose={onClose} centered>
      <Flex direction={"column"} gap="xs">
        <Select
          label={"Location Type"}
          data={[{ value: "repository", label: "Repository" }]}
          value={locationType}
          onChange={setLocationType}
        />
        {locationType === "repository" ? (
          <RepositoryConfig
            deviceId={deviceId}
            metadataRepo={metadataRepo}
            onClose={onClose}
          />
        ) : null}
      </Flex>
    </Modal>
  );
};
