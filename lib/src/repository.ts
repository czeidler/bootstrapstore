import { Kysely } from "kysely";
import type { BlobStore, BlobStoreGetter } from "./blob-store";
import { DB } from "./db/db";
import { migrateToLatest } from "./migration";
import { SerializableDB, SerializableDBInstance } from "./sqlite";
import { AESGCMEncryption, Encryption, sha256 } from "./encryption";
import { IndexRepository, Snapshot, TreeEntryType } from "./index-repository";
import { BlobInfo, DBHash, TreeBuilder } from "./tree-builder";
import {
  arraysEqual,
  arrayToHex,
  concatArrayBuffers,
  ExhaustiveCheckError,
} from "./utils";
import { AnnotatedCompression, Compression } from "./compression";
import { Hash } from "./hasher";
import {
  findCommonAncestor,
  getRelatedCommits,
  getRepoCommitInfo,
  pullMissingBlobs,
  threeWayMerge,
} from "./graph-helper";

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
    public config: RepoConfig,
  ) {}

  private indexRepo!: IndexRepository;
  private treeBuilder!: TreeBuilder;
  public commitHash256?: Hash;

  private async init(snapshotHash?: Hash) {
    const kysely = new Kysely<DB>({
      dialect: this.instance.dialect,
    });
    this.indexRepo = new IndexRepository(kysely);

    const snapshot = snapshotHash
      ? await this.indexRepo.readSnapshot(snapshotHash)
      : await this.indexRepo.readBranchHead(this.config.branch);
    this.commitHash256 = snapshot?.hash256;
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

  async listCommits(): Promise<Snapshot[]> {
    const head = await this.indexRepo.readBranchHead(this.config.branch);
    if (head === undefined) {
      return [];
    }
    const commits = await this.indexRepo.listCommits();
    return Array.from(getRelatedCommits(head, commits).values());
  }

  async branch(
    branch: string,
    inlined: boolean,
    snapshot?: Hash,
  ): Promise<Repository> {
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
    await repo.init(snapshot);
    return repo;
  }

  static blobPath(hex: string): string[] {
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
      await this.store.write(Repository.blobPath(cipherHashHex), cipher);
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
    const head = await this.indexRepo.readBranchHead(this.config.branch);
    const treeHash = await this.treeBuilder.finalize(this.indexRepo);
    if (
      (head?.tree === undefined && treeHash === undefined) ||
      (head?.tree !== undefined &&
        treeHash !== undefined &&
        arraysEqual(head.tree[1], treeHash[1]))
    ) {
      // no change
      return;
    }
    this.commitHash256 = await this.indexRepo.writeSnapshot(
      treeHash,
      timestamp,
      head ? [arrayToHex(head.hash256)] : [],
      this.config.branch,
    );
    const plain = await this.instance.serialize();
    const zipped = await new AnnotatedCompression(
      this.ioConfig.compression,
    ).compress(plain);
    const cipher = await this.encryption.encrypt(zipped, this.config.key);
    await this.store.write(["index"], cipher);
  }

  private async resetToSnapshot(tree: DBHash | undefined, commitHash: Hash) {
    this.treeBuilder = new TreeBuilder(
      tree ? await this.indexRepo.readTree(tree) : { entries: new Map() },
    );
    this.commitHash256 = commitHash;
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
          const cipher = await this.store.read(Repository.blobPath(hex));
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
            hash256: entry.hash[1],
          };
        case "r":
          return {
            type: "repo",
            name,
            repoId: entry.repoId,
          };
        case "t":
          return {
            type: "dir",
            name,
            hash256: entry.hash?.[1],
          };
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

  async pull(theirs: Repository, timestamp: Date) {
    // Save existing changes
    // TODO make it an error if there are changes when calling pull?
    await this.createSnapshot(timestamp);

    const ours = await getRepoCommitInfo(
      this.config.branch,
      this.indexRepo,
      this.store,
    );
    const theirsInfo = await getRepoCommitInfo(
      this.config.branch,
      theirs.indexRepo,
      theirs.store,
    );
    const pulledCommits = await pullMissingBlobs(ours, theirsInfo);
    if (pulledCommits.length === 0) {
      return;
    }

    // We need to work with the snapshot pulled into our repo
    const theirHead = theirsInfo.head?.hash256
      ? await this.indexRepo.readSnapshot(theirsInfo.head.hash256)
      : undefined;
    if (theirHead === undefined) {
      return;
    }

    if (
      ours.head === undefined ||
      theirsInfo.commits.has(arrayToHex(ours.head.hash256))
    ) {
      // fast forward to their head
      await this.indexRepo.writeSnapshot(
        theirHead.tree,
        theirHead.timestamp,
        theirHead.parents,
        this.config.branch,
      );
      await this.resetToSnapshot(theirHead.tree, theirHead.hash256);
      return;
    }

    const commonAncestor = findCommonAncestor(
      ours.head,
      Array.from(ours.commits.values()),
      theirHead,
      Array.from(theirsInfo.commits.values()),
    );
    if (commonAncestor === undefined) {
      throw Error("Two way merge not implemented yet");
    }
    const { treeHash, parents } = await threeWayMerge(
      ours.repo,
      commonAncestor,
      ours.head,
      theirHead,
      ({ our, their }) => {
        if (our?.type === "b" && their?.type === "b") {
          return our.modificationTime > their.modificationTime ? our : their;
        }
        if (
          (ours.head?.timestamp.getTime() ?? 0) > theirHead.timestamp.getTime()
        ) {
          return our;
        } else {
          return their;
        }
      },
    );
    const commitHash = await this.indexRepo.writeSnapshot(
      treeHash,
      timestamp,
      parents.map(arrayToHex),
      this.config.branch,
    );
    await this.resetToSnapshot(treeHash, commitHash);
  }
}
