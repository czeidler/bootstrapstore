import {
  arrayToHex,
  LocationInfo,
  MetadataRepository,
  Repository,
  rootDir,
  VFSDir,
} from "lib";
import { FileBrowser } from "./FileBrowser";
import {
  Combobox,
  Flex,
  Tabs,
  Text,
  ThemeIcon,
  Tooltip,
  Collapse,
  Button,
} from "@mantine/core";
import { useChildRepo } from "./account-hooks";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconClock } from "@tabler/icons-react";
import { base64ToUint8Array, hexToUint8Array } from "lib/src/utils";
import { AccountData } from "lib/src/account";
import { useDisclosure } from "@mantine/hooks";

function RepoHistoryFileBrowser({
  metadataRepo,
  repo,
  root,
}: {
  metadataRepo: MetadataRepository;
  repo: Repository;
  root: VFSDir | undefined;
}) {
  const { data } = useQuery({
    queryKey: ["repository", repo.repoId, "commits"],
    queryFn: () => repo.listCommits(),
  });

  const [currentRepo, setCurrentRepo] = useState(
    root
      ? {
          root,
          hash256: repo.commitHash256 ? arrayToHex(repo.commitHash256) : "",
        }
      : undefined,
  );
  const [selectedCommit, setSelectedCommit] = useState(
    repo.commitHash256 ? arrayToHex(repo.commitHash256) : "",
  );
  useEffect(() => {
    if (selectedCommit.length === 0) {
      return;
    }
    const current = selectedCommit;
    repo
      .branch(repo.config.branch, repo.config.inlined, hexToUint8Array(current))
      .then((it) => {
        setCurrentRepo({ root: rootDir(it, metadataRepo), hash256: current });
      })
      .catch((e) => console.log(e));
  }, [metadataRepo, repo, selectedCommit]);
  return (
    <Flex direction={"row"} gap={5} h="100%">
      <Flex direction={"column"} justify={"start"}>
        <Combobox>
          <Combobox.Options style={{ justifyItems: "start" }}>
            {data?.map((it) => {
              const hashStr = arrayToHex(it.hash256);
              return (
                <Combobox.Option
                  key={hashStr}
                  value={hashStr}
                  onClick={() => setSelectedCommit(hashStr)}
                  selected={selectedCommit === hashStr}
                >
                  <Tooltip
                    label={`${arrayToHex(it.hash256).slice(0, 8)}, parents: ${it.parents.map((it) => it.slice(0, 8))}`}
                  >
                    <Flex direction={"row"} gap={5} align={"center"}>
                      <ThemeIcon color="teal" size={24} radius="xl">
                        <IconClock size={16} />
                      </ThemeIcon>

                      {`${it.timestamp.toLocaleString()}`}
                    </Flex>
                  </Tooltip>
                </Combobox.Option>
              );
            })}
          </Combobox.Options>
        </Combobox>
      </Flex>
      <Flex direction={"column"} style={{ flexGrow: 1 }}>
        <FileBrowser key={currentRepo?.hash256} root={currentRepo?.root} />
      </Flex>
    </Flex>
  );
}

export function LocationRepoView({
  deviceId,
  location,
  metadataRepo,
  accountData,
}: {
  deviceId: string;
  location: LocationInfo;
  metadataRepo: MetadataRepository;
  accountData: AccountData;
}) {
  if (location.type !== "repository") {
    throw Error("Location not a repository");
  }

  const { data } = useChildRepo(metadataRepo, deviceId, location.repoId);
  // metadata is not a child repo (not on the main branch)
  const repo =
    metadataRepo.metaRepo.repoId === location.id ? metadataRepo.metaRepo : data;

  const root = useMemo(() => {
    return repo && metadataRepo ? rootDir(repo, metadataRepo) : undefined;
  }, [metadataRepo, repo]);
  const [activeTab, setActiveTab] = useState<string | null>("details");

  const [showPublicUrl, { toggle: toggleShowPublicUrl }] = useDisclosure(false);

  return (
    <Flex
      direction="column"
      style={{
        width: "100%",
      }}
    >
      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        style={{ display: "flex", flexDirection: "column", height: "100%" }}
      >
        <Tabs.List>
          <Tabs.Tab value="details">Detail</Tabs.Tab>
          <Tabs.Tab value="browse">Browser</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="details">
          <Flex direction={"column"} align={"start"}>
            <Text>Id: {location.id}</Text>
            <Text>Repo Id: {location.repoId}</Text>
            <Text>Name: {location.name}</Text>
            <Text>Path: {location.path}</Text>
            <Flex align={"center"} gap="xs">
              <Text>Public url query params: {location.path}</Text>
              <Button onClick={() => toggleShowPublicUrl()} size="xs">
                {showPublicUrl ? "Hide" : "Show"}
              </Button>{" "}
              <Collapse expanded={showPublicUrl}>
                <Text>{` ?repoId=${location.repoId}&key=${Buffer.from(base64ToUint8Array(location.encKey)).toString("hex")}`}</Text>
              </Collapse>
            </Flex>
          </Flex>
        </Tabs.Panel>
        <Tabs.Panel value="browse" mih={"0"}>
          {repo === undefined ? null : (
            <RepoHistoryFileBrowser
              metadataRepo={metadataRepo}
              repo={repo}
              root={root}
            />
          )}
        </Tabs.Panel>
      </Tabs>
    </Flex>
  );
}
