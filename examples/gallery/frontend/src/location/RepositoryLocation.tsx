import { useState } from "react";
import { useCreateChildRepo } from "../account-hooks";
import { MetadataRepository } from "lib";
import { RepositoryLocationInfo } from "lib/src/main-repo";
import { LocationConfigLayout } from "./LocationConfigLayout";
import { TextInput } from "@mantine/core";

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
  const [name, setName] = useState(init?.name ?? "");
  const [path, setPath] = useState(init?.path ?? "");
  const { mutateAsync } = useCreateChildRepo(metadataRepo, deviceId);
  const save = async () => {
    await mutateAsync({
      repoName: name,
      path,
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
