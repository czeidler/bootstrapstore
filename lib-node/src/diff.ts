import { readdirSync, statSync } from "node:fs";
import path from "path";
import { DirEntry, Repository } from "lib";

export interface DirReader {
  list(path: string[]): Promise<DirEntry[]>;
}

export type DiffEntry = {
  path: string[];
} & (
  | {
      /** Relative to the "ours" dir, e.g. entry was Added in "ours"  */
      type: "Added";
      our: DirEntry;
    }
  | {
      /** Relative to the "ours" dir, e.g. entry was Deleted in "ours"  */
      type: "Deleted";
      their: DirEntry;
    }
  | {
      type: "Changed";
      our: DirEntry;
      their: DirEntry;
    }
);

export const diffWalk = async (
  ours: DirReader,
  theirs: DirReader,
  callback: (entry: DiffEntry) => void,
) => {
  const ongoingDirs: string[][] = [[]];
  let currentDir;
  while ((currentDir = ongoingDirs.pop())) {
    const ourContent = await ours.list(currentDir);
    ourContent.sort((a, b) => a.name.localeCompare(b.name));
    const theirContent = await theirs.list(currentDir);
    theirContent.sort((a, b) => a.name.localeCompare(b.name));

    let indexOur = 0;
    let indexTheir = 0;
    while (indexOur < ourContent.length || indexTheir < theirContent.length) {
      const our = ourContent.at(indexOur);
      const their = theirContent.at(indexTheir);
      const cmp =
        their === undefined
          ? -1
          : our === undefined
            ? 1
            : our.name.localeCompare(their.name);
      if (cmp === 1) {
        // theirs is missing, i.e. their is deleted
        indexTheir++;
        if (their === undefined) {
          throw Error("Unexpected");
        }
        callback({
          path: [...currentDir, their.name],
          type: "Deleted",
          their,
        });
      } else if (cmp === -1) {
        // ours has an addition, i.e. our is added
        indexOur++;
        if (our === undefined) {
          throw Error("Unexpected");
        }
        callback({
          path: [...currentDir, our.name],
          type: "Added",
          our,
        });
      } else {
        // same
        indexOur++;
        indexTheir++;
        if (their === undefined || our === undefined) {
          throw Error("Unexpected");
        }
        const path = [...currentDir, our.name];
        if (their.type === "dir" && our.type === "dir") {
          ongoingDirs.push(path);
        } else if (their.type === "dir" || our.type === "dir") {
          callback({
            path,
            type: "Deleted",
            their,
          });
          callback({
            path,
            type: "Added",
            our,
          });
        } else if (our.type === "file" && their.type === "file") {
          if (
            their.creationTime !== our.creationTime ||
            their.modificationTime !== our.modificationTime ||
            their.size !== our.size
          ) {
            callback({
              path,
              type: "Changed",
              our,
              their,
            });
          }
        } else {
          console.warn(`Ignore: ${path}`);
        }
      }
    }
  }
};

export class FSDirReader implements DirReader {
  constructor(private basePath: string[]) {}
  async list(p: string[]): Promise<DirEntry[]> {
    const content = readdirSync(path.join(...this.basePath, ...p));
    return content.map((name) => {
      const stats = statSync(path.join(...this.basePath, ...p, name));
      return stats.isDirectory()
        ? ({
            type: "dir",
            name,
          } satisfies DirEntry)
        : ({
            type: "file",
            name,
            size: stats.size,
            creationTime: Math.floor(stats.ctimeMs),
            modificationTime: Math.floor(stats.mtimeMs),
          } satisfies DirEntry);
    });
  }
}

export class RepoDirReader implements DirReader {
  constructor(private repo: Repository) {}
  async list(path: string[]): Promise<DirEntry[]> {
    const content = await this.repo.listDirectory(path);
    return content ?? [];
  }
}
