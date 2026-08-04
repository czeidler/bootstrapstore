import { useState } from "react";
import { useCreateChildRepo, useDevicesWithLocations } from "../account-hooks";
import { MetadataRepository } from "lib";
import { RepositoryLocationInfo } from "lib/src/main-repo";
import { LocationConfigLayout } from "./LocationConfigLayout";
import { Select, TextInput } from "@mantine/core";
import { base64ToUint8Array } from "lib/src/utils";

export function RepositoryConfig({
  onClose,
  deviceId,
  metadataRepo,
  init,
}: {
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
  init?: RepositoryLocationInfo;
}) {
  // source repo
  const [locationId, setLocationId] = useState<string | null>();
  const { data: devicesWithLocations } = useDevicesWithLocations(metadataRepo);
  const localRepos = devicesWithLocations
    ?.find((it) => it.device.id === deviceId)
    ?.locations.filter((it) => it.type === "repository");
  const options = localRepos?.map((item) => ({
    value: item.id,
    label: item.name ?? item.id,
  }));

  const [name, setName] = useState(init?.name ?? "");
  const [path, setPath] = useState(init?.path ?? "");
  const { mutateAsync } = useCreateChildRepo(metadataRepo, deviceId);
  const save = async () => {
    const repoLocation = localRepos?.find((it) => it.id === locationId);
    await mutateAsync({
      repoName: name,
      path,
      key: repoLocation?.encKey
        ? base64ToUint8Array(repoLocation.encKey)
        : undefined,
      repoId: repoLocation?.repoId,
    });
    onClose();
  };

  return (
    <LocationConfigLayout
      Content={
        <>
          <TextInput
            label="Name"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
          {init !== undefined ? null : (
            <Select
              label="Copy Repository"
              data={options}
              value={locationId}
              onChange={setLocationId}
            />
          )}
          <TextInput
            label="Path"
            value={path}
            onChange={(event) => setPath(event.currentTarget.value)}
          />
        </>
      }
      onClose={onClose}
      save={save}
      disabled={false}
    />
  );
}
