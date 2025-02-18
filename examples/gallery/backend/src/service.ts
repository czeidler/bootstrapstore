import { FileBlobStore } from "lib-node";
import { RepoBlobStoreGetter } from "lib/src/blob-store";
import { argv } from "node:process";

const repoDir = argv[2] ?? "testRepo";

const store = new FileBlobStore([repoDir, ".storage", "repos"]);
export const storeGetter = new RepoBlobStoreGetter(store);
