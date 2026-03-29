import { Kysely } from "kysely";
import type { BlobStore, BlobStoreGetter } from "./blob-store";
import { DB } from "./db/db";
import { migrateToLatest } from "./migration";
import { SerializableDB, SerializableDBInstance } from "./sqlite";
import { AESGCMEncryption, Encryption, sha256 } from "./encryption";
import { IndexRepository, TreeEntryType } from "./index-repository";
import { BlobInfo, TreeBuilder } from "./tree-builder";
import { arrayToHex, concatArrayBuffers, ExhaustiveCheckError } from "./utils";
import { AnnotatedCompression, Compression } from "./compression";

export type DirEntry =
  | {
      type: "dir";
      name: string;
    }
  | {
      type: "file";
      name: string;
      size: number;
      creationTime: number;
      modificationTime: number;
    }
  | {
      type: "repo";
      name: string;
      repoId: string;
    };

export type RepoConfig = {
  key: Uint8Array;
  /** Branch name */
  branch: string;
  /** All data is stored in the index */
  inlined: boolean;
};

export type RepoIOConfig = {
  serializeDb: SerializableDB;
  compression: Compression;
};

export class Repository {
  private constructor(
    public repoId: string,
    private store: BlobStore,
    private encryption: Encryption,

    private ioConfig: RepoIOConfig,
    private instance: SerializableDBInstance,
    private config: RepoConfig,
  ) {}

  private indexRepo!: IndexRepository;
  private treeBuilder!: TreeBuilder;

  private async init() {
    const kysely = new Kysely<DB>({
      dialect: this.instance.dialect,
    });
    this.indexRepo = new IndexRepository(kysely);

    const snapshot = await this.indexRepo.readSnapshot(this.config.branch);
    if (snapshot === undefined) {
      this.treeBuilder = new TreeBuilder({ entries: new Map() });
    } else {
      this.treeBuilder = new TreeBuilder(
        snapshot.tree
          ? await this.indexRepo.readTree(snapshot.tree)
          : { entries: new Map() },
      );
    }
  }

  static async create(
    repoId: string,
    { serializeDb, compression }: RepoIOConfig,
    storeGetter: BlobStoreGetter,
    key: Uint8Array,
  ): Promise<void> {
    const instance = await serializeDb.create(undefined);
    const kysely = new Kysely<DB>({
      dialect: instance.dialect,
    });
    await migrateToLatest(kysely as Kysely<unknown>);

    const buffer = await instance.serialize();
    const zipped = await new AnnotatedCompression(compression).compress(buffer);
    const encryption: Encryption = new AESGCMEncryption();
    const cipher = await encryption.encrypt(zipped, key);
    const store = storeGetter.get(repoId);
    await store.write(["index"], cipher);
  }

  static async open(
    repoId: string,
    repoIOConfig: RepoIOConfig,
    storeGetter: BlobStoreGetter,
    config: RepoConfig,
  ): Promise<Repository> {
    const { serializeDb, compression } = repoIOConfig;
    const store = storeGetter.get(repoId);
    const buffer = await store.read(["index"]);
    const encryption: Encryption = new AESGCMEncryption();
    const plain = await encryption.decrypt(buffer, config.key);
    const decompressed = await new AnnotatedCompression(compression).decompress(
      plain,
    );
    const instance = await serializeDb.create(decompressed);
    const kysely = new Kysely<DB>({
      dialect: instance.dialect,
    });
    await migrateToLatest(kysely as Kysely<unknown>);

    const repo = new Repository(
      repoId,
      store,
      encryption,
      repoIOConfig,
      instance,
      config,
    );
    await repo.init();
    return repo;
  }

  async branch(branch: string, inlined: boolean): Promise<Repository> {
    const repo = new Repository(
      this.repoId,
      this.store,
      this.encryption,
      this.ioConfig,
      this.instance,
      {
        ...this.config,
        branch,
        inlined,
      },
    );
    await repo.init();
    return repo;
  }

  private blobPath(hex: string): string[] {
    return ["blobs", hex.slice(0, 2), hex.slice(2)];
  }

  async insertFile(
    path: string[],
    data: Uint8Array,
    creationTime: number,
    modificationTime: number,
  ): Promise<void> {
    const writeDataToStore = async () => {
      const encKey = crypto.getRandomValues(new Uint8Array(16));
      const cipher = await this.encryption.encrypt(data, encKey);
      const cipherHash = sha256(cipher);
      const cipherHashHex = arrayToHex(cipherHash);
      await this.store.write(this.blobPath(cipherHashHex), cipher);
      return {
        type: "encrypted",
        encKey,
        parts: [cipherHash],
      } satisfies BlobInfo;
    };
    const blobInfo: BlobInfo = this.config.inlined
      ? {
          type: "inlined",
          parts: [data],
        }
      : await writeDataToStore();

    const plainHash = sha256(data);
    const existing = await this.indexRepo.readContent(plainHash);
    const plainDBHash =
      existing !== undefined
        ? existing
        : await this.indexRepo.writeBlobInfo(plainHash, blobInfo);

    await this.treeBuilder.insertEntry(this.indexRepo, path, {
      type: TreeEntryType.Blob,
      hash: plainDBHash,
      size: data.length,
      creationTime,
      modificationTime,
    });
  }

  async insertRepoLink(path: string[], repoId: string): Promise<void> {
    await this.treeBuilder.insertEntry(this.indexRepo, path, {
      type: TreeEntryType.RepoLink,
      repoId,
    });
  }

  async insertDirs(path: string[]): Promise<void> {
    await this.treeBuilder.insertEntry(this.indexRepo, path, {
      type: TreeEntryType.Tree,
      hash: undefined,
      data: { entries: new Map() },
    });
  }

  async deleteEntry(path: string[]): Promise<void> {
    await this.treeBuilder.deleteEntry(this.indexRepo, path);
  }

  async createSnapshot(timestamp: Date): Promise<void> {
    const head = await this.indexRepo.readSnapshot(this.config.branch);
    const treeHash = await this.treeBuilder.finalize(this.indexRepo);
    await this.indexRepo.writeSnapshot(
      treeHash,
      timestamp,
      head ? [head.hash256] : [],
      this.config.branch,
    );
    const plain = await this.instance.serialize();
    const zipped = await new AnnotatedCompression(
      this.ioConfig.compression,
    ).compress(plain);
    const cipher = await this.encryption.encrypt(zipped, this.config.key);
    await this.store.write(["index"], cipher);
  }

  async readFile(path: string[]): Promise<Uint8Array | undefined> {
    const fileEntry = await this.treeBuilder.readBlob(this.indexRepo, path);
    if (fileEntry === undefined) {
      return undefined;
    }
    const info = await this.indexRepo.readBlobInfo(fileEntry.hash[1]);
    if (info.type === "inlined") {
      return concatArrayBuffers(info.parts);
    } else {
      const plainParts = await Promise.all(
        info.parts.map(async (part) => {
          const hex = arrayToHex(part);
          const cipher = await this.store.read(this.blobPath(hex));
          return this.encryption.decrypt(cipher, info.encKey);
        }),
      );
      return concatArrayBuffers(plainParts);
    }
  }

  /**
   * @returns the repo id
   */
  async readRepoLink(path: string[]): Promise<string | undefined> {
    const entry = await this.treeBuilder.readRepoLink(this.indexRepo, path);
    if (entry === undefined) {
      return undefined;
    }
    return entry.repoId;
  }

  async listDirectory(path: string[]): Promise<DirEntry[]> {
    const directory = await this.treeBuilder.loadTree(this.indexRepo, path, {
      createMissingDirs: false,
      writeable: false,
    });
    if (typeof directory === "string") {
      throw Error(directory);
    }
    return Array.from(directory.entries.entries()).map((it) => {
      const [name, entry] = it;
      switch (entry.type) {
        case "b":
          return {
            type: "file",
            name,
            size: entry.size,
            creationTime: entry.creationTime,
            modificationTime: entry.modificationTime,
          };
        case "r":
          return {
            type: "repo",
            name,
            repoId: entry.repoId,
          };
        case "t":
        case "mutateTree":
          return {
            type: "dir",
            name,
          };
        default:
          throw new ExhaustiveCheckError(entry);
      }
    });
  }
}
