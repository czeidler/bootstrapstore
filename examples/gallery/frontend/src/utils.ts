import { HttpBlobStore } from "./HttpBlobStore";
import { BlobStore, BlobStoreGetter } from "lib";

export const imageExtensions = [".jpg", ".png"];

export const storeGetter: BlobStoreGetter = {
  get: function (repoId: string | undefined): BlobStore {
    return new HttpBlobStore(repoId);
  },
};
