import { Button, Modal, Flex, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { MetadataRepository, shortId, SyncInfo } from "lib";
import { useState } from "react";
import { DeviceWithLocations, useCreateSync, useSyncs } from "./account-hooks";
import { Divider } from "@mui/material";
import { SyncDirStatus } from "./SyncDirStatus";
import { useMutation } from "@tanstack/react-query";
import { trustedTsr } from "./tsr";

const CreateSyncDialog = ({
  open,
  onClose,
  deviceId,
  locationId,
  metadataRepo,
  init,
}: {
  open: boolean;
  onClose: () => void;
  deviceId: string;
  locationId: string;
  metadataRepo: MetadataRepository;
  init?: SyncInfo;
}) => {
  const [from, setFrom] = useState(init?.type === "cp" ? init.fromPath : "");
  const [to, setTo] = useState(init?.type === "cp" ? init.toPath : "");
  const { mutateAsync } = useCreateSync(metadataRepo, deviceId, locationId);
  const create = async () => {
    if (to === "" || from === "") {
      return;
    }
    await mutateAsync({
      id: init?.id ?? shortId(),
      type: "cp",
      fromPath: from,
      toPath: to,
    });
    onClose();
  };
  return (
    <Modal opened={open} onClose={onClose}>
      <Flex direction={"column"} gap={10}>
        <Text id="alert-dialog-title">Copy</Text>
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
        <Flex gap={10} justify={"end"}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={create}
            autoFocus
            disabled={to === "" || from === ""}
          >
            Save
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
};

function SyncDirEntry({
  syncInfo,
  metadataRepo,
  deviceId,
  locationId,
}: {
  syncInfo: SyncInfo;
  metadataRepo: MetadataRepository;
  deviceId: string;
  locationId: string;
}) {
  const [openEditDialog, { toggle: toogleEdit, close: closeEdit }] =
    useDisclosure(false);
  const [openDryRunDialog, { toggle, close }] = useDisclosure(false);

  const { mutate: cpDir, isPending: isCopying } = useMutation({
    mutationFn: async () => {
      if (syncInfo.type !== "cp") {
        return;
      }

      const result = await trustedTsr.syncDir({
        body: {
          syncId: syncInfo.id,
          from: { path: syncInfo.fromPath },
          to: { path: syncInfo.toPath },
        },
      });
      if (result.status !== 201) {
        throw Error(`HTTP status ${result.status}`);
      }
      return result.body;
    },
  });
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
        <Button onClick={toggle} disabled={isCopying}>
          Dry Run
        </Button>
        <Button onClick={() => cpDir()} disabled={isCopying}>
          Run
        </Button>
        <Button onClick={toogleEdit} disabled={isCopying}>
          Edit
        </Button>
      </Flex>
      {syncInfo.type === "cp" && (
        <Modal opened={openDryRunDialog} onClose={close} size={"80vw"}>
          <SyncDirStatus
            fromPath={syncInfo.fromPath}
            toPath={syncInfo.toPath}
          />
        </Modal>
      )}
      {openEditDialog && (
        <CreateSyncDialog
          deviceId={deviceId}
          locationId={locationId}
          metadataRepo={metadataRepo}
          open={openEditDialog}
          init={syncInfo}
          onClose={closeEdit}
        />
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
          <SyncDirEntry
            key={it.id}
            metadataRepo={metadataRepo}
            deviceId={deviceId}
            locationId={locationId}
            syncInfo={it}
          />
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
