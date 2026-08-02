import { FileBlobStore } from "lib-node";
import { RepoBlobStoreGetter } from "lib";
import { argv } from "node:process";
import path from "node:path";

export const repoDir = path.resolve(argv[2] ?? "testRepo");

export const storeGetter = (userId: string) =>
  new RepoBlobStoreGetter(new FileBlobStore([repoDir, ".storage", userId]));
