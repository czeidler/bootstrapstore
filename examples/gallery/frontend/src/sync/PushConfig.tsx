import { useState } from "react";
import { MetadataRepository, shortId } from "lib";
import { useCreateSync, useDevicesWithLocations } from "../account-hooks";
import { Select, TextInput } from "@mantine/core";
import { SyncConfigLayout } from "./SyncConfigLayout";
import { SyncPushRepoInfo } from "lib/src/main-repo";

export const PushConfig = ({
  onClose,
  deviceId,
  metadataRepo,
  init,
}: {
  onClose: () => void;
  deviceId: string;
  metadataRepo: MetadataRepository;
  init?: SyncPushRepoInfo;
}) => {
  const [repoId, setRepoId] = useState(init?.repoId ?? null);
  const [to, setTo] = useState(init?.to.path ?? "");
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
    if (to === "" || repoId === null) {
      return;
    }
    await mutateAsync({
      id: init?.id ?? shortId(),
      type: "push",
      repoId,
      to: { path: to },
    });
    onClose();
  };
  return (
    <SyncConfigLayout
      Content={
        <>
          <Select
            label="Repository"
            data={options}
            value={repoId}
            onChange={setRepoId}
          />

          <TextInput
            label="To"
            value={to}
            onChange={(event) => setTo(event.currentTarget.value)}
          />
        </>
      }
      onClose={onClose}
      save={save}
      disabled={to === "" || repoId === null}
    />
  );
};
