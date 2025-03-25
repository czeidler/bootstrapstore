import { BlobStoreGetter } from "./blob-store";
import { DirEntry, Repository } from "./repository";
import { SerializableDB } from "./sqlite";
import { arrayToHex } from "./utils";

export type RepositoryInfo = {
  id: string;
  encKey: string;
  /**
   * If not set the "default" search path is used
   */
  path?: string;
  name?: string;
};

type RemoteInfo = {
  id: string;
  name?: string;
  description?: string;
  machineId?: string;
};

export type CheckoutInfo = {
  id: string;
  type: "repo";
  /**
   * Path to the source directory
   */
  path: string;
  repoId: string;
};

const remoteDir = "remotes";
const remotePath = (remoteId: string) => [remoteDir, remoteId];
const repositoryBasePath = (remoteId: string) => [
  remoteDir,
  remoteId,
  "repositories",
];
const repositoryInfoPath = (remoteId: string, repoId: string) => [
  remoteDir,
  remoteId,
  "repositories",
  repoId,
  "repo.json",
];
const checkoutBasePath = (remoteId: string) => [
  remoteDir,
  remoteId,
  "checkouts",
];
const checkoutInfoPath = (remoteId: string, checkoutId: string) => [
  remoteDir,
  remoteId,
  "checkouts",
  checkoutId,
  "checkout.json",
];

/**
 * Data structure in the metadata branch:
 *
 * type RepoMetadata = {
 *   remotes: Record<
 *     string,
 *     {
 *       "remote.json": RemoteInfo;
 *       repositories: Record<string, { "repo.json": RepositoryInfo }>;
 *       checkouts: Record<string, { "checkout.json": CheckoutInfo }>;
 *     }
 *   >;
 * };
 */
export class MetadataRepository {
  private constructor(
    public metaRepo: Repository,
    private storeGetter: BlobStoreGetter,
    private serializeDb: SerializableDB
  ) {}

  static async open(
    repoId: string,
    storeGetter: BlobStoreGetter,
    serializeDb: SerializableDB,
    key: Buffer
  ): Promise<MetadataRepository> {
    const metaRepo = await Repository.open(repoId, serializeDb, storeGetter, {
      key,
      branch: ".metadata",
      inlined: true,
    });
    return new MetadataRepository(metaRepo, storeGetter, serializeDb);
  }

  static async fromRepo(
    repo: Repository,
    storeGetter: BlobStoreGetter,
    serializeDb: SerializableDB
  ): Promise<MetadataRepository> {
    const metaRepo = await repo.branch(".metadata", true);
    return new MetadataRepository(metaRepo, storeGetter, serializeDb);
  }

  private async write(path: string[], obj: object) {
    const now = Date.now();
    await this.metaRepo.insertFile(
      path,
      Buffer.from(JSON.stringify(obj)),
      now,
      now
    );
  }

  private async read<T>(path: string[]): Promise<T | undefined> {
    const buf = await this.metaRepo.readFile(path);
    if (buf === undefined) {
      return undefined;
    }
    return JSON.parse(buf.toString()) as T;
  }

  async addRemote(remoteInfo: RemoteInfo) {
    await this.write([...remotePath(remoteInfo.id), "remote.json"], remoteInfo);
  }

  async listRemotes(): Promise<DirEntry[]> {
    const entries = await this.metaRepo.listDirectory([remoteDir]);
    return entries ?? [];
  }

  async getRemote(remoteId: string): Promise<RemoteInfo | undefined> {
    return this.read<RemoteInfo>([...remotePath(remoteId), "remote.json"]);
  }

  async listRepositories(remoteId: string): Promise<DirEntry[]> {
    const entries = await this.metaRepo.listDirectory(
      repositoryBasePath(remoteId)
    );
    return entries ?? [];
  }

  async writeRepository(remoteId: string, repoInfo: RepositoryInfo) {
    await this.write(repositoryInfoPath(remoteId, repoInfo.id), repoInfo);
  }

  async readRepository(
    remoteId: string,
    repoId: string
  ): Promise<RepositoryInfo | undefined> {
    return this.read<RepositoryInfo>(repositoryInfoPath(remoteId, repoId));
  }

  async listCheckouts(remoteId: string): Promise<DirEntry[]> {
    const entries = await this.metaRepo.listDirectory(
      checkoutBasePath(remoteId)
    );
    return entries ?? [];
  }

  async writeCheckout(remoteId: string, checkoutInfo: CheckoutInfo) {
    await this.write(checkoutInfoPath(remoteId, checkoutInfo.id), checkoutInfo);
  }

  async readCheckout(
    remoteId: string,
    checkoutId: string
  ): Promise<CheckoutInfo | undefined> {
    return this.read<CheckoutInfo>(checkoutInfoPath(remoteId, checkoutId));
  }

  async snapshot() {
    await this.metaRepo.createSnapshot(new Date());
  }

  async createChild(remoteId: string, repoName?: string): Promise<Repository> {
    const repoId = arrayToHex(crypto.getRandomValues(new Uint8Array(12)));
    const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
    await Repository.create(repoId, this.serializeDb, this.storeGetter, key);
    const repo = Repository.open(repoId, this.serializeDb, this.storeGetter, {
      key,
      branch: "main",
      inlined: false,
    });

    await this.writeRepository(remoteId, {
      id: repoId,
      encKey: key.toString("base64"),
      name: repoName,
    });

    // TODO move to separate method?
    await this.metaRepo.createSnapshot(new Date());
    return repo;
  }

  async openChild(
    remoteId: string,
    repoId: string
  ): Promise<Repository | undefined> {
    const repoInfo = await this.readRepository(remoteId, repoId);
    if (repoInfo === undefined) {
      return undefined;
    }
    const repo = Repository.open(repoId, this.serializeDb, this.storeGetter, {
      key: Buffer.from(repoInfo.encKey, "base64"),
      branch: "main",
      inlined: false,
    });
    return repo;
  }
}
