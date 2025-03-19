import { useSearchParams } from "react-router-dom";
import { Stack } from "@mui/material";
import { useEffect, useState } from "react";
import { Repository } from "lib";
import { SqlocalSerializableDB } from "./sqlite";

import { storeGetter } from "./utils";
import { FileBrowser } from "./FileBrowser";

export type PathStackEntry = {
  repo: Repository;
  repoPath: string[];
  path: string[];
};
export const Home = () => {
  const [searchParams] = useSearchParams();
  const keyParam = searchParams.get("key");
  const repoId = searchParams.get("repoId") ?? "";

  const [repo, setRepo] = useState<Repository>();

  useEffect(() => {
    (async () => {
      const key = Buffer.from(keyParam ?? "", "hex");
      const repo = await Repository.open(
        repoId,
        SqlocalSerializableDB,
        storeGetter,
        {
          key,
          branch: "main",
          inlined: false,
        }
      );
      setRepo(repo);
    })();
  }, [repoId, keyParam]);

  return (
    <Stack style={{ width: "100%", height: "100%" }} gap={1}>
      <FileBrowser repo={repo} />
    </Stack>
  );
};
