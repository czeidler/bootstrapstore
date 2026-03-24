import { Button, Modal, Flex, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { MetadataRepository, shortId } from "lib";
import { useState } from "react";
import { DeviceWithLocations, useCreateSync, useSyncs } from "./account-hooks";
import { Divider } from "@mui/material";

const CreateSyncDialog = ({
  open,
  onClose,
  deviceId,
  locationId,
  metadataRepo,
}: {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  locationId: string;
  metadataRepo: MetadataRepository;
}) => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { mutateAsync } = useCreateSync(metadataRepo, deviceId, locationId);
  const create = async () => {
    if (to === "" || from === "") {
      return;
    }
    await mutateAsync({
      id: shortId(),
      type: "cp",
      fromPath: from,
      toPath: to,
    });
    onClose();
  };
  return (
    <Modal opened={open} onClose={onClose}>
      <Text id="alert-dialog-title">Copy to</Text>
      <Flex direction={"column"}>
        <Text>From</Text>
        <TextInput
          value={from}
          onChange={(event) => setFrom(event.currentTarget.value)}
        />
        <Text>To</Text>
        <TextInput
          value={to}
          onChange={(event) => setTo(event.currentTarget.value)}
        />
      </Flex>
      <Flex>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={create} autoFocus disabled={to === "" || from === ""}>
          Create
        </Button>
      </Flex>
    </Modal>
  );
};

export function SyncDirView({
  metadataRepo,
  deviceId,
  locationId,
  devicesWithLocations,
}: {
  metadataRepo: MetadataRepository;
  deviceId: string;
  locationId: string;
  devicesWithLocations: DeviceWithLocations[] | undefined;
}) {
  const { data: syncs } = useSyncs(metadataRepo, deviceId, locationId);
  const [openCreateSyncDialog, { toggle, close }] = useDisclosure(false);
  return (
    <>
      <Flex h={"100%"} direction={"column"}>
        <Flex direction={"row"}>
          <Button onClick={toggle}>Add Sync</Button>
        </Flex>
        <Divider />
        <Text>Syncs</Text>
        {syncs?.map((it) => (
          <Flex key={it.id} direction={"row"} gap={5}>
            <Text>Id: {it.id}</Text>
            <Text>Type: {it.type}</Text>
            <Button>Dry Run</Button>
          </Flex>
        ))}
      </Flex>
      <CreateSyncDialog
        deviceId={deviceId}
        locationId={locationId}
        metadataRepo={metadataRepo}
        open={openCreateSyncDialog}
        onClose={close}
      />
    </>
  );
}
