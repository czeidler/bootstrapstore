import { MetadataRepository, Repository } from "lib";
import { DirEntry } from "lib/src/repository";
import { useCallback, useEffect, useState } from "react";
import { SqlocalSerializableDB } from "./sqlite";
import { BlobStoreGetter } from "lib/src/blob-store";

export type PathStackEntry = {
  repo: Repository;
  repoPath: string[];
  path: string[];
};

export const useFileNavigation = (
  repo: Repository | undefined,
  storeGetter: BlobStoreGetter
) => {
  const [mainRepo, setMainRepo] = useState<Promise<MetadataRepository>>();
  const [pathStack, setPathStack] = useState<PathStackEntry[]>([]);
  const currentPath: PathStackEntry | undefined =
    pathStack[pathStack.length - 1];
  const [dirEntries, setDirEntries] = useState<DirEntry[]>([]);
  useEffect(() => {
    (async () => {
      if (currentPath === undefined) {
        return;
      }
      const content = await currentPath.repo.listDirectory(
        currentPath.repoPath
      );
      setDirEntries(content ?? []);
    })();
  }, [currentPath]);

  useEffect(() => {
    if (!repo) {
      setPathStack([]);
      return;
    }
    setMainRepo(MetadataRepository.init(repo));
    setPathStack([{ repo, repoPath: [], path: [] }]);
  }, [repo]);

  const onBack = useCallback(() => {
    if (!currentPath) {
      return;
    }
    if (currentPath.repoPath.length === 0) {
      setPathStack(pathStack.slice(0, -1));
      return;
    }
    setPathStack([
      ...pathStack.slice(0, -1),
      {
        repo: currentPath.repo,
        path: currentPath.path.slice(0, -1),
        repoPath: currentPath.repoPath.slice(0, -1),
      },
    ]);
  }, [currentPath, pathStack]);
  const openFolder = useCallback(
    async (row: DirEntry) => {
      if (pathStack.length === 0) {
        return;
      }
      const currentPath = pathStack[pathStack.length - 1];
      if (row.type === "dir") {
        setPathStack([
          ...pathStack.slice(0, -1),
          {
            repo: currentPath.repo,
            repoPath: [...currentPath.repoPath, row.name],
            path: [...currentPath.path, row.name],
          },
        ]);
        return;
      }
      if (row.type === "repo") {
        const mRepo = mainRepo ?? MetadataRepository.init(currentPath.repo);
        setMainRepo(mRepo);
        const child = await (
          await mRepo
        ).openChild("default", row.repoId, SqlocalSerializableDB, storeGetter);
        if (child === undefined) {
          return;
        }
        setPathStack([
          ...pathStack,
          {
            repo: child,
            repoPath: [],
            path: [...currentPath.path, row.name],
          },
        ]);
      }
    },
    [mainRepo, pathStack, storeGetter]
  );

  return { onBack, openFolder, currentPath, dirEntries };
};
