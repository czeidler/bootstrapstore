import { useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { MetadataRepository, Repository, rootDir } from "lib";

import { storeGetter } from "./utils";
import { FileBrowser } from "./FileBrowser";
import { getRepoIOConfig } from "./io-config";
import { hexToUint8Array } from "lib/src/utils";
import { Flex } from "@mantine/core";

export const Home = () => {
  const [searchParams] = useSearchParams();
  const keyParam = searchParams.get("key");
  const repoId = searchParams.get("repoId") ?? "";

  const [repo, setRepo] = useState<{
    repo: Repository;
    metadataRepository: MetadataRepository;
  }>();

  useEffect(() => {
    (async () => {
      const key = hexToUint8Array(keyParam ?? "");
      const repo = await Repository.open(
        repoId,
        getRepoIOConfig(),
        storeGetter,
        {
          key,
          branch: "main",
          inlined: false,
        },
      );
      const metadataRepository = await MetadataRepository.fromRepo(
        repo,
        storeGetter,
        getRepoIOConfig(),
      );
      setRepo({ repo, metadataRepository });
    })();
  }, [repoId, keyParam]);

  const root = useMemo(() => {
    return repo?.repo && repo?.metadataRepository
      ? rootDir(repo?.repo, repo?.metadataRepository)
      : undefined;
  }, [repo?.metadataRepository, repo?.repo]);

  return (
    <Flex direction="column" style={{ width: "100%", height: "100%" }} gap={1}>
      <FileBrowser root={root} />
    </Flex>
  );
};
