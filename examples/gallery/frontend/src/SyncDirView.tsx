import { Button, Modal, Flex, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { MetadataRepository, shortId, SyncInfo } from "lib";
import { useState } from "react";
import { DeviceWithLocations, useCreateSync, useSyncs } from "./account-hooks";
import { Divider } from "@mui/material";
import { SyncDirStatus } from "./SyncDirStatus";

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

function SyncDirEntry({ syncInfo }: { syncInfo: SyncInfo }) {
  const [openDryRunDialog, { toggle, close }] = useDisclosure(false);
  return (
    <>
      <Flex key={syncInfo.id} direction={"column"} gap={5} align={"start"}>
        <Text>Id: {syncInfo.id}</Text>
        <Text>Type: {syncInfo.type}</Text>
        {syncInfo.type === "cp" ? (
          <>
            <Text>From: {syncInfo.fromPath}</Text>
            <Text>To: {syncInfo.toPath}</Text>
          </>
        ) : null}
        <Button onClick={toggle}>Dry Run</Button>
      </Flex>
      {syncInfo.type === "cp" && (
        <Modal opened={openDryRunDialog} onClose={close} size={"80vw"}>
          <SyncDirStatus
            fromPath={syncInfo.fromPath}
            toPath={syncInfo.toPath}
          />
        </Modal>
      )}
    </>
  );
}

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
          <SyncDirEntry key={it.id} syncInfo={it} />
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
