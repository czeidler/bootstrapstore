import { HttpBlobStore } from "./HttpBlobStore";
import { BlobStore, BlobStoreGetter } from "lib/src/blob-store";

export const imageExtensions = [".jpg", ".png"];

export const storeGetter: BlobStoreGetter = {
  get: function (repoId: string): BlobStore {
    return new HttpBlobStore(repoId);
  },
};
