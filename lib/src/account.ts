import { BlobStore, BlobStoreGetter } from "./blob-store";
import { AESGCMEncryption, Encryption } from "./encryption";
import { MetadataRepository } from "./main-repo";
import { RepoIOConfig, Repository } from "./repository";
import { shortId } from "./utils";

export type AccountFile = {
  encDataBase64: string;
};

export type AccountData = {
  /** Main repo id */
  repoId: string;
  /** Main repo key */
  repoKeyBase64: string;
  /**
   * The remote id for this account, i.e. where this account is located / checked out.
   * Points to a remote in the main repo.
   */
  remoteId: string;
};

export async function readAccountFile(
  blobStore: BlobStore
): Promise<AccountFile | undefined> {
  const accountPath = ["account.json"];
  if (!(await blobStore.exists(accountPath))) {
    return undefined;
  }

  const content = await blobStore.read(accountPath);
  return JSON.parse(content.toString()) as AccountFile;
}

async function writeAccountFile(
  blobStore: BlobStore,
  file: AccountFile
): Promise<void> {
  const accountPath = ["account.json"];
  await blobStore.write(accountPath, Buffer.from(JSON.stringify(file)));
}

export class Account {
  private constructor(
    private storeGetter: BlobStoreGetter,
    private ioConfig: RepoIOConfig,
    public accountData: AccountData
  ) {}

  static async openAccount(
    storeGetter: BlobStoreGetter,
    ioConfig: RepoIOConfig,
    key: Buffer,
    file: AccountFile
  ): Promise<Account> {
    const enc: Encryption = new AESGCMEncryption();
    const plain = await enc.decrypt(
      Buffer.from(file.encDataBase64, "base64"),
      key
    );
    const data = JSON.parse(plain.toString()) as AccountData;
    return new Account(storeGetter, ioConfig, data);
  }

  static async createAccount(
    store: BlobStore,
    storeGetter: BlobStoreGetter,
    ioConfig: RepoIOConfig,
    key: Buffer
  ): Promise<Account> {
    const enc: Encryption = new AESGCMEncryption();

    const repoId = shortId();
    const repoKey = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
    await Repository.create(repoId, ioConfig, storeGetter, repoKey);

    const metadataRepo = await MetadataRepository.open(
      repoId,
      storeGetter,
      ioConfig,
      repoKey
    );
    const remoteId = shortId();
    await metadataRepo.addRemote({
      id: remoteId,
    });
    const repoKeyBase64 = repoKey.toString("base64");
    await metadataRepo.writeRepository(remoteId, {
      id: repoId,
      encKey: repoKeyBase64,
    });
    await metadataRepo.snapshot();

    const accountData: AccountData = { repoId, remoteId, repoKeyBase64 };
    const cipher = await enc.encrypt(
      Buffer.from(JSON.stringify(accountData)),
      key
    );
    const file: AccountFile = {
      encDataBase64: cipher.toString("base64"),
    };

    await writeAccountFile(store, file);
    return new Account(storeGetter, ioConfig, accountData);
  }

  openMetadataRepo(): Promise<MetadataRepository> {
    return MetadataRepository.open(
      this.accountData.repoId,
      this.storeGetter,
      this.ioConfig,
      Buffer.from(this.accountData.repoKeyBase64, "base64")
    );
  }
}
