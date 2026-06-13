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
import fs from "fs/promises";
import path from "path";
import { base64ToUint8Array } from "lib/src/utils";

export const pushRepo = async ({
  repoId,
  encKey,
  from,
  to,
}: {
  repoId: string;
  encKey: string;
  from: { path?: string; branch?: string; inlined?: boolean };
  to: { path: string; branch?: string; inlined?: boolean };
}) => {
  const fromStoreGetter =
    from.path === undefined
      ? storeGetter
      : new RepoBlobStoreGetter(new FileBlobStore(from.path.split("/")));
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
    new FileBlobStore(to.path.split("/")),
  );
  const targetBlobStore = targetStoreGetter.get(repoId);
  if (!(await targetBlobStore.exists(["index"]))) {
    const sourceBlobStore = fromStoreGetter.get(repoId);
    const index = await sourceBlobStore.read(["index"]);
    await targetBlobStore.write(["index"], index);
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

export const syncRepoStatus = async ({
  repoId,
  checkoutPath,
  encKey,
}: {
  repoId: string;
  checkoutPath: string;
  encKey: string;
}): Promise<DiffEntry[]> => {
  const output: DiffEntry[] = [];
  const repo = await Repository.open(repoId, getRepoIOConfig(), storeGetter, {
    key: base64ToUint8Array(encKey),
    branch: "main",
    inlined: false,
  });
  await diffWalk(
    new FSDirReader([checkoutPath]),
    new RepoDirReader(repo),
    (entry) => output.push(entry),
  );
  return output;
};

export const syncRepo = async ({
  repoId,
  checkoutPath,
  encKey,
}: {
  repoId: string;
  checkoutPath: string;
  encKey: string;
}) => {
  const output: DiffEntry[] = [];
  const repo = await Repository.open(repoId, getRepoIOConfig(), storeGetter, {
    key: base64ToUint8Array(encKey),
    branch: "main",
    inlined: false,
  });
  await diffWalk(
    new FSDirReader([checkoutPath]),
    new RepoDirReader(repo),
    (entry) => output.push(entry),
  );

  for (const out of output) {
    const fsPath = `${path.join(...checkoutPath, ...out.path)}`;
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
