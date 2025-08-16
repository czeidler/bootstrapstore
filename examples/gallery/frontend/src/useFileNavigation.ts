import { Repository } from "lib";
import { useCallback, useEffect, useState } from "react";
import { VFSDir, VFSEntry } from "lib";

export type PathStackEntry = {
  repo: Repository;
  repoPath: string[];
  path: string[];
};

export const useFileNavigation = (root: VFSDir | undefined) => {
  const [pathStack, setPathStack] = useState<{ path: string[]; dir: VFSDir }[]>(
    []
  );
  const currentPath: { path: string[]; dir: VFSDir } | undefined =
    pathStack[pathStack.length - 1];
  const [dirEntries, setDirEntries] = useState<VFSEntry[]>([]);
  useEffect(() => {
    (async () => {
      if (currentPath === undefined) {
        return;
      }
      const content = await currentPath.dir.list();
      setDirEntries(content);
    })();
  }, [currentPath]);

  useEffect(() => {
    if (!root) {
      setPathStack([]);
      return;
    }
    setPathStack([{ path: [], dir: root }]);
  }, [root]);

  const onBack = useCallback(() => {
    if (!currentPath) {
      return;
    }
    setPathStack([...pathStack.slice(0, -1)]);
  }, [currentPath, pathStack]);
  const openFolder = useCallback(
    async (name: string) => {
      const entry = dirEntries.find((it) => it.name === name);
      if (entry === undefined) {
        return;
      }
      if (entry.type === "dir" || entry.type === "repo") {
        setPathStack([
          ...pathStack,
          { path: [...currentPath.path, name], dir: entry.content },
        ]);
      }
    },
    [pathStack, currentPath, dirEntries]
  );

  return { onBack, openFolder, currentPath: currentPath.path, dirEntries };
};
