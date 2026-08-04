import { Flex, Modal } from "@mantine/core";
import { MetadataRepository } from "lib";
import { RepositoryConfig } from "./RepositoryLocation";
import { LocationInfo } from "lib/src/main-repo";

export const EditLocationDialog = ({
  open,
  onClose,
  deviceId,
  metadataRepo,
  locationInfo,
}: {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
  locationInfo: LocationInfo;
}) => {
  return (
    <Modal title={"Add Location"} opened={open} onClose={onClose} centered>
      <Flex direction={"column"} gap="xs">
        {locationInfo.type === "repository" ? (
          <RepositoryConfig
            deviceId={deviceId}
            metadataRepo={metadataRepo}
            onClose={onClose}
            init={locationInfo}
          />
        ) : null}
      </Flex>
    </Modal>
  );
};
