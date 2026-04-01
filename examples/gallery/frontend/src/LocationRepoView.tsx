import {
  arrayToHex,
  LocationInfo,
  MetadataRepository,
  Repository,
  rootDir,
  VFSDir,
} from "lib";
import { FileBrowser } from "./FileBrowser";
import { Flex, Tabs, Text } from "@mantine/core";
import { useChildRepo } from "./account-hooks";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

function RepoHistoryFileBrowser({
  repo,
  root,
}: {
  repo: Repository;
  root: VFSDir | undefined;
}) {
  const { data } = useQuery({
    queryKey: ["repository", repo.repoId, "commits"],
    queryFn: () => repo.listCommits(),
  });

  return (
    <Flex direction={"row"} gap={5}>
      <Flex direction={"column"}>
        {data?.map((it) => (
          <Text
            key={arrayToHex(it.hash256)}
          >{`${it.timestamp.toLocaleString()} ${arrayToHex(it.hash256).slice(0, 8)}, parents: ${it.parents.map((it) => it.slice(0, 8))}`}</Text>
        ))}
      </Flex>
      <Flex direction={"column"} style={{ flexGrow: 1 }}>
        <FileBrowser root={root} />
      </Flex>
    </Flex>
  );
}

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
          {repo === undefined ? null : (
            <RepoHistoryFileBrowser repo={repo} root={root} />
          )}
        </Tabs.Panel>
      </Tabs>
    </Flex>
  );
}
