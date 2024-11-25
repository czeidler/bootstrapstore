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

  private blobPath(hex: string): string[] {
    return [...this.basePath, "blobs", hex.slice(0, 2), hex.slice(2)];
  }

  async insertFile(path: string[], data: Buffer): Promise<void> {
    const cipher = await this.encryption.encrypt(data, this.key);
    const cipherHash = await sha256(cipher);
    const cipherHashHex = cipher.toString("hex");
    await this.store.write(this.blobPath(cipherHashHex), cipher);
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

  async createSnapshot(timestamp: Date): Promise<void> {
    const head = await this.indexRepo.readLatestSnapshot();
    const treeHash = await TreeBuilder.finalizeTree(this.indexRepo, this.root);
    await this.indexRepo.writeSnapshot(
      treeHash,
      timestamp,
      head ? [head.hash256] : []
    );
  }

  async readFile(path: string[]): Promise<Buffer | undefined> {
    const fileEntry = await TreeBuilder.readBlob(
      this.indexRepo,
      this.root,
      path
    );
    if (fileEntry === undefined) {
      return undefined;
    }
    const info = await this.indexRepo.readEncryptedBlobInfo(fileEntry?.hash[1]);
    const plainParts = await Promise.all(
      info.encryptedParts.map(async (part) => {
        const hex = part.toString("hex");
        const cipher = await this.store.read(this.blobPath(hex));
        return this.encryption.decrypt(cipher, info.key);
      })
    );
    return Buffer.concat(plainParts);
  }

  async listDirectory(path: string[]): Promise<DirEntry[] | undefined> {
    const directory = await TreeBuilder.loadTree(
      this.indexRepo,
      this.root,
      path
    );
    return Array.from(directory.entries.entries()).map((it) => ({
      name: it[0],
    }));
  }
}
