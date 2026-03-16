import { LocationInfo, MetadataRepository, rootDir } from "lib";
import { FileBrowser } from "./FileBrowser";
import { Flex, Tabs, Text } from "@mantine/core";
import { useChildRepo } from "./account-hooks";
import { useMemo, useState } from "react";

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
  const [activeTab, setActiveTab] = useState<string | null>("details");
  return (
    <Flex direction="column" style={{ width: "100%" }}>
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="details">Detail</Tabs.Tab>
          <Tabs.Tab value="browse">Browser</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details">
          <Text>Name: {location.name}</Text>
          <Text>Path: {location.path}</Text>
        </Tabs.Panel>
        <Tabs.Panel value="browse">
          {repo === undefined ? null : <FileBrowser root={root} />}
        </Tabs.Panel>
      </Tabs>
    </Flex>
  );
}
