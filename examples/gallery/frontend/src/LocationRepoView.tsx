import { LocationInfo, MetadataRepository, rootDir } from "lib";
import { FileBrowser } from "./FileBrowser";
import { Flex, Text } from "@mantine/core";
import { useChildRepo } from "./account-hooks";
import { useMemo } from "react";

export function LocationRepoView({
  deviceId,
  location,
  metadataRepo,
}: {
  deviceId: string;
  location: LocationInfo;
  metadataRepo: MetadataRepository;
}) {
  if (location.type !== "repository") {
    throw Error("Location not a repository");
  }

  const { data } = useChildRepo(metadataRepo, deviceId, location.id);
  // metadata is not a child repo (not on the main branch)
  const repo =
    metadataRepo.metaRepo.repoId === location.id ? metadataRepo.metaRepo : data;

  const root = useMemo(() => {
    return repo && metadataRepo ? rootDir(repo, metadataRepo) : undefined;
  }, [metadataRepo, repo]);
  return (
    <Flex direction="column" style={{ width: "100%" }}>
      <Text>Name: {location.name}</Text>
      <Text>Path: {location.path}</Text>

      {repo === undefined ? null : <FileBrowser root={root} />}
    </Flex>
  );
}
