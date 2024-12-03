import path from "path";
import { Repository } from "./repository";

import fs from "fs/promises";

export async function snapshotDir(repo: Repository, dir: string) {
  type Ongoing = {
    // parts relative to dir;
    pathParts: string[];
    path: string;
  };
  const ongoing: Ongoing[] = [{ pathParts: [], path: dir }];
  while (ongoing.length > 0) {
    const currentDir = ongoing.pop();
    if (currentDir === undefined) {
      throw Error("Internal error");
    }
    const entryNames = await fs.readdir(dir);
    for (const entryName of entryNames) {
      const entryParts = [...currentDir.path, entryName];
      const entryPath = path.join(currentDir.path, entryName);

      const stats = await fs.stat(entryPath);
      if (stats.isDirectory()) {
        ongoing.push({
          pathParts: entryParts,
          path: entryPath,
        });
        continue;
      }
      if (stats.isSymbolicLink()) {
        console.error("Ignore sym links");
        continue;
      }
      if (!stats.isFile()) {
        console.error(`Unexpected file type: ${entryPath}`);
        continue;
      }
      const blob = await fs.readFile(entryPath);

      console.log(`> Insert: ${entryPath}`);
      await repo.insertFile(entryParts, blob);
    }
  }
  await repo.createSnapshot(new Date());
}
