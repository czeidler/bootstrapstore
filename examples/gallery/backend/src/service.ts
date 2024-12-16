import { FileBlobStore } from "lib-node";
import { argv } from "node:process";

const repoDir = argv[2] ?? "testRepo";

export const store = new FileBlobStore([repoDir]);
