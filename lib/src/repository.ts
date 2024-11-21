import { Kysely } from "kysely";
import { BlobStore } from "./blob-store";
import { DB } from "./db/db";
import { migrateToLatest } from "./migration";
import { SerializableDB, SerializableDBInstance } from "./sqlite";
import { AESGCMEncryption, Encryption, sha256 } from "./encryption";
import { IndexRepository } from "./index-repository";
import { Tree, TreeBuilder } from "./tree-builder";

export type DirEntry = {
  name: string;
};

class Repository {
  private constructor(
    private store: BlobStore,
    private encryption: Encryption,
    private key: Buffer,
    private basePath: string[],
    private repo_id: string,
    private instance: SerializableDBInstance
  ) {}

  private indexRepo!: IndexRepository;
  private root!: Tree;

  private async init() {
    const kysely = new Kysely<DB>({
      dialect: this.instance.dialect,
    });
    this.indexRepo = new IndexRepository(kysely);

    const snapshot = await this.indexRepo.readLatestSnapshot();
    if (snapshot === undefined) {
      this.root = { entries: new Map() };
    } else {
      this.root = await this.indexRepo.readTree(snapshot.tree);
    }
  }

  static async create(
    serializeDb: SerializableDB,
    store: BlobStore,
    basePath: string,
    key: Buffer
  ): Promise<Repository> {
    const repo_id = Buffer.from(
      crypto.getRandomValues(new Uint8Array(16))
    ).toString("base64");

    const repoPath = [basePath, "repos", repo_id];

    const instance = serializeDb.create(undefined);
    const kysely = new Kysely<DB>({
      dialect: instance.dialect,
    });
    await migrateToLatest(kysely as Kysely<unknown>);
    await kysely.destroy();

    const buffer = instance.serialize();
    const encryption: Encryption = new AESGCMEncryption();
    const cipher = await encryption.encrypt(buffer, key);
    await store.write([...repoPath, "index"], cipher);

    const repo = new Repository(
      store,
      encryption,
      key,
      repoPath,
      repo_id,
      instance
    );
    await repo.init();
    return repo;
  }

  static async open(
    serializeDb: SerializableDB,
    store: BlobStore,
    basePath: string,
    repo_id: string,
    key: Buffer
  ): Promise<Repository> {
    const repoPath = [basePath, "repos", repo_id];
    const buffer = await store.read([...repoPath, "index"]);
    const encryption: Encryption = new AESGCMEncryption();
    const plain = await encryption.decrypt(buffer, key);
    const instance = serializeDb.create(plain);
    const kysely = new Kysely<DB>({
      dialect: instance.dialect,
    });
    await migrateToLatest(kysely as Kysely<unknown>);
    await kysely.destroy();

    const repo = new Repository(
      store,
      encryption,
      key,
      repoPath,
      repo_id,
      instance
    );
    await repo.init();
    return repo;
  }

  async insertFile(path: string[], data: Buffer): Promise<void> {
    const cipher = await this.encryption.encrypt(data, this.key);
    const cipherHash = await sha256(cipher);
    const chipherHashHex = cipher.toString("hex");
    await this.store.write(
      [
        ...this.basePath,
        "blobs",
        chipherHashHex.slice(0, 2),
        chipherHashHex.slice(2),
      ],
      cipher
    );
    const plainHash = sha256(data);
    const existing = await this.indexRepo.readContent(plainHash);
    const blobDBHash =
      existing !== undefined
        ? existing
        : await this.indexRepo.writeEncryptedBlobInfo(plainHash, {
            key: Buffer.from(crypto.getRandomValues(new Uint8Array(16))),
            encryptedParts: [cipherHash],
          });

    TreeBuilder.insertBlob(this.indexRepo, this.root, path, {
      type: "blob",
      hash: blobDBHash,
    });
  }

  async snapshot(timestamp: Date): Promise<void> {}

  async readFile(path: string[]): Promise<Buffer | undefined> {}

  async listDirectory(path: string[]): Promise<DirEntry[] | undefined> {}
}
