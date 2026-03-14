import { LocationInfo, MetadataRepository } from "lib";
import { FileBrowser } from "./FileBrowser";
import { Flex, Text } from "@mantine/core";
import { useChildRepo } from "./account-hooks";

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

  return (
    <Flex direction="column" style={{ width: "100%" }}>
      <Text>Name: {location.name}</Text>
      <Text>Path: {location.path}</Text>

      {repo === undefined ? null : (
        <FileBrowser repo={repo} metadataRepo={metadataRepo} />
      )}
    </Flex>
  );
}
