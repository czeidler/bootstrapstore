import { FileBlobStore } from "lib-node";
import { BlobStore, RepoBlobStoreGetter } from "lib";
import { argv } from "node:process";
import { arrayToString, stringToUint8Array } from "lib/src/utils";
import path from "node:path";

export const repoDir = path.resolve(argv[2] ?? "testRepo");

const store = new FileBlobStore([repoDir, ".storage"]);
export const storeGetter = new RepoBlobStoreGetter(store);

export type AccountFile = {
  encDataBase64: string;
};

class AccountFileIO {
  constructor(private blobStore: BlobStore) {}

  async readAccountFile(): Promise<AccountFile | undefined> {
    const accountPath = ["account.json"];
    if (!(await this.blobStore.exists(accountPath))) {
      return undefined;
    }

    const content = await this.blobStore.read(accountPath);
    return JSON.parse(arrayToString(content));
  }

  async writeAccountFile(file: AccountFile): Promise<void> {
    const accountPath = ["account.json"];
    this.blobStore.write(accountPath, stringToUint8Array(JSON.stringify(file)));
  }
}

export const accountFile = new AccountFileIO(store);
