import { RepoBlobStoreGetter, Repository } from "lib";
import {
  DiffEntry,
  diffWalk,
  FSDirReader,
  RepoDirReader,
  getRepoIOConfig,
  FileBlobStore,
} from "lib-node";
import { storeGetter } from "./service";
import fs, { mkdir } from "fs/promises";
import path from "path";
import { base64ToUint8Array, pathToArray } from "lib/src/utils";

export const pushRepo = async (
  userId: string,
  {
    repoId,
    encKey,
    from,
    to,
  }: {
    repoId: string;
    encKey: string;
    from: { path?: string; branch?: string; inlined?: boolean };
    to: { path: string; branch?: string; inlined?: boolean };
  },
) => {
  const fromStoreGetter = !from.path
    ? storeGetter(userId)
    : new RepoBlobStoreGetter(new FileBlobStore(pathToArray(from.path)));
  const fromRepo = await Repository.open(
    repoId,
    getRepoIOConfig(),
    fromStoreGetter,
    {
      key: base64ToUint8Array(encKey),
      branch: from.branch ?? "main",
      inlined: from.inlined ?? false,
    },
  );
  const targetStoreGetter = new RepoBlobStoreGetter(
    new FileBlobStore(pathToArray(to.path)),
  );

  // to
  await mkdir(to.path, { recursive: true });
  if (!(await Repository.exists(repoId, targetStoreGetter))) {
    await Repository.create(
      repoId,
      getRepoIOConfig(),
      targetStoreGetter,
      base64ToUint8Array(encKey),
    );
  }
  const toRepo = await Repository.open(
    repoId,
    getRepoIOConfig(),
    targetStoreGetter,
    {
      key: base64ToUint8Array(encKey),
      branch: to.branch ?? "main",
      inlined: to.inlined ?? false,
    },
  );
  await toRepo.pull(fromRepo, new Date());
};

export const syncRepoStatus = async (
  userId: string,
  {
    repoId,
    checkoutPath,
    encKey,
  }: {
    repoId: string;
    checkoutPath: string;
    encKey: string;
  },
): Promise<DiffEntry[]> => {
  const output: DiffEntry[] = [];
  const repo = await Repository.open(
    repoId,
    getRepoIOConfig(),
    storeGetter(userId),
    {
      key: base64ToUint8Array(encKey),
      branch: "main",
      inlined: false,
    },
  );
  await diffWalk(
    new FSDirReader([checkoutPath]),
    new RepoDirReader(repo),
    (entry) => output.push(entry),
  );
  return output;
};

export const syncRepo = async (
  userId: string,
  {
    repoId,
    checkoutPath,
    encKey,
  }: {
    repoId: string;
    checkoutPath: string;
    encKey: string;
  },
) => {
  const checkoutPathArray = pathToArray(checkoutPath);
  const output: DiffEntry[] = [];
  const repo = await Repository.open(
    repoId,
    getRepoIOConfig(),
    storeGetter(userId),
    {
      key: base64ToUint8Array(encKey),
      branch: "main",
      inlined: false,
    },
  );
  await diffWalk(
    new FSDirReader(checkoutPathArray),
    new RepoDirReader(repo),
    (entry) => output.push(entry),
  );

  for (const out of output) {
    const fsPath = `${path.join(...checkoutPathArray, ...out.path)}`;
    switch (out.type) {
      case "Added":
      case "Changed": {
        const stat = await fs.stat(fsPath);
        const blob = await fs.readFile(fsPath);
        await repo.insertFile(
          out.path,
          blob,
          Math.floor(stat.ctimeMs),
          Math.floor(stat.mtimeMs),
        );
        break;
      }
      case "Deleted":
        await repo.deleteEntry(out.path);
        break;
    }
  }
  if (output.length > 0) {
    await repo.createSnapshot(new Date());
  }
};
