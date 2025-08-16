import { useSearchParams } from "react-router-dom";
import { Stack } from "@mui/material";
import { useEffect, useState } from "react";
import { MetadataRepository, Repository } from "lib";

import { storeGetter } from "./utils";
import { FileBrowser } from "./FileBrowser";
import { getRepoIOConfig } from "./io-config";

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
      const key = Buffer.from(keyParam ?? "", "hex");
      const repo = await Repository.open(
        repoId,
        getRepoIOConfig(),
        storeGetter,
        {
          key,
          branch: "main",
          inlined: false,
        }
      );
      const metadataRepository = await MetadataRepository.fromRepo(
        repo,
        storeGetter,
        getRepoIOConfig()
      );
      setRepo({ repo, metadataRepository });
    })();
  }, [repoId, keyParam]);

  return (
    <Stack style={{ width: "100%", height: "100%" }} gap={1}>
      <FileBrowser repo={repo?.repo} metadataRepo={repo?.metadataRepository} />
    </Stack>
  );
};
