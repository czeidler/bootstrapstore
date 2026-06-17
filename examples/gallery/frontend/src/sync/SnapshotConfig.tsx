import { useState } from "react";
import { MetadataRepository, shortId } from "lib";
import { useCreateSync, useDevicesWithLocations } from "../account-hooks";
import { Select, TextInput } from "@mantine/core";
import { SyncConfigLayout } from "./SyncConfigLayout";
import { SnapshotInfo } from "lib/src/main-repo";

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
