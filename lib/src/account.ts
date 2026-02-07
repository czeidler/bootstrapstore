import { BlobStore, BlobStoreGetter } from "./blob-store";
import { AESGCMEncryption, Encryption } from "./encryption";
import { MetadataRepository } from "./main-repo";
import { RepoIOConfig, Repository } from "./repository";
import {
  arrayToString,
  base64ToUint8Array,
  shortId,
  stringToUint8Array,
  uint8ArrayToBase64,
} from "./utils";

export type AccountFile = {
  encDataBase64: string;
};

export type AccountData = {
  /** Main repo id */
  repoId: string;
  /** Main repo key */
  repoKeyBase64: string;
  /**
   * The profile id for this account, i.e. where this account is located / checked out.
   * Points to a profile in the main repo.
   */
  deviceId: string;
};

export async function readAccountFile(
  blobStore: BlobStore,
): Promise<AccountFile | undefined> {
  const accountPath = ["account.json"];
  if (!(await blobStore.exists(accountPath))) {
    return undefined;
  }

  const content = await blobStore.read(accountPath);
  return JSON.parse(arrayToString(content)) as AccountFile;
}

async function writeAccountFile(
  blobStore: BlobStore,
  file: AccountFile,
): Promise<void> {
  const accountPath = ["account.json"];
  await blobStore.write(accountPath, stringToUint8Array(JSON.stringify(file)));
}

export class Account {
  private constructor(
    private storeGetter: BlobStoreGetter,
    private ioConfig: RepoIOConfig,
    public accountData: AccountData,
  ) {}

  static async openAccount(
    storeGetter: BlobStoreGetter,
    ioConfig: RepoIOConfig,
    key: Uint8Array,
    file: AccountFile,
  ): Promise<Account> {
    const enc: Encryption = new AESGCMEncryption();
    const plain = await enc.decrypt(
      base64ToUint8Array(file.encDataBase64),
      key,
    );
    const data = JSON.parse(arrayToString(plain)) as AccountData;
    return new Account(storeGetter, ioConfig, data);
  }

  static async createAccount(
    store: BlobStore,
    storeGetter: BlobStoreGetter,
    ioConfig: RepoIOConfig,
    key: Uint8Array,
  ): Promise<Account> {
    const enc: Encryption = new AESGCMEncryption();

    const repoId = shortId();
    const repoKey = crypto.getRandomValues(new Uint8Array(16));
    await Repository.create(repoId, ioConfig, storeGetter, repoKey);

    const metadataRepo = await MetadataRepository.open(
      repoId,
      storeGetter,
      ioConfig,
      repoKey,
    );
    const deviceId = shortId();
    await metadataRepo.addDevice({
      id: deviceId,
    });
    const repoKeyBase64 = uint8ArrayToBase64(repoKey);
    await metadataRepo.writeLocation(deviceId, {
      id: repoId,
      type: "repository",
      encKey: repoKeyBase64,
    });
    await metadataRepo.snapshot();

    const accountData: AccountData = {
      repoId,
      deviceId: deviceId,
      repoKeyBase64,
    };
    const cipher = await enc.encrypt(
      stringToUint8Array(JSON.stringify(accountData)),
      key,
    );
    const file: AccountFile = {
      encDataBase64: uint8ArrayToBase64(cipher),
    };

    await writeAccountFile(store, file);
    return new Account(storeGetter, ioConfig, accountData);
  }

  openMetadataRepo(): Promise<MetadataRepository> {
    return MetadataRepository.open(
      this.accountData.repoId,
      this.storeGetter,
      this.ioConfig,
      base64ToUint8Array(this.accountData.repoKeyBase64),
    );
  }
}
