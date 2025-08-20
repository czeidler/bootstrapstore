import { BlobStoreGetter } from "./blob-store";
import { DirEntry, RepoIOConfig, Repository } from "./repository";
import { shortId } from "./utils";

export type ProfileInfo = {
  id: string;
  name?: string;
  description?: string;
  machineId?: string;
};

export type RemoteInfo = {
  id: string;
  type: "sftp";
  host: string;
  user: string;
  keyPem: string;
};

export type DirectoryLocationInfo = {
  id: string;
  type: "directory";
  path: string;
};
export type RepositoryLocationInfo = {
  id: string;
  type: "repository";
  encKey: string;
  /**
   * If not set the "default" search path is used
   */
  path?: string;
  name?: string;
};
export type LocationInfo = DirectoryLocationInfo | RepositoryLocationInfo;

export type SyncConfig =
  | {
      id: string;
      type: "repo";
      /** Points to the repo checkout */
      checkout: {
        id: string;
        remoteId?: string;
      };
      repository: {
        id: string;
        /** If undefined it means it local */
        remoteId?: string;
      };
    }
  | {
      id: string;
      type: "checkout";
      checkout1: {
        id: string;
        remoteId?: string;
      };
      checkout2: {
        id: string;
        remoteId?: string;
      };
    };

const profileDir = "profiles";
const profilePath = (profileId: string) => [profileDir, profileId];
const remoteBasePath = (profileId: string) => [
  profileDir,
  profileId,
  "remotes",
];
const remotePath = (profileId: string, remoteId: string) => [
  profileDir,
  profileId,
  "remotes",
  remoteId,
  "remote.json",
];
const locationBasePath = (profileId: string) => [
  profileDir,
  profileId,
  "locations",
];
const locationInfoPath = (profileId: string, locationId: string) => [
  profileDir,
  profileId,
  "locations",
  locationId,
  "location.json",
];

const syncBasePath = (profileId: string) => [profileDir, profileId, "sync"];
const syncInfoPath = (profileId: string, syncId: string) => [
  profileDir,
  profileId,
  "sync",
  syncId,
  "sync.json",
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
    private ioConfig: RepoIOConfig
  ) {}

  static async open(
    repoId: string,
    storeGetter: BlobStoreGetter,
    ioConfig: RepoIOConfig,
    key: Buffer
  ): Promise<MetadataRepository> {
    const metaRepo = await Repository.open(repoId, ioConfig, storeGetter, {
      key,
      branch: ".metadata",
      inlined: true,
    });
    return new MetadataRepository(metaRepo, storeGetter, ioConfig);
  }

  static async fromRepo(
    repo: Repository,
    storeGetter: BlobStoreGetter,
    ioConfig: RepoIOConfig
  ): Promise<MetadataRepository> {
    const metaRepo = await repo.branch(".metadata", true);
    return new MetadataRepository(metaRepo, storeGetter, ioConfig);
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

  async addProfile(profileInfo: ProfileInfo) {
    await this.write(
      [...profilePath(profileInfo.id), "profile.json"],
      profileInfo
    );
  }

  async listProfile(): Promise<DirEntry[]> {
    const entries = await this.metaRepo.listDirectory([profileDir]);
    return entries;
  }

  async getProfile(profileId: string): Promise<ProfileInfo | undefined> {
    return this.read<ProfileInfo>([...profilePath(profileId), "profile.json"]);
  }

  // connections
  async listRemotes(profileId: string): Promise<DirEntry[]> {
    const entries = await this.metaRepo.listDirectory(
      remoteBasePath(profileId)
    );
    return entries;
  }

  async readRemote(
    profileId: string,
    remoteId: string
  ): Promise<RemoteInfo | undefined> {
    return this.read<RemoteInfo>(remotePath(profileId, remoteId));
  }

  async writeRemote(profileId: string, remote: RemoteInfo) {
    await this.write(remotePath(profileId, remote.id), remote);
  }

  // locations
  async listLocations(profileId: string): Promise<DirEntry[]> {
    const entries = await this.metaRepo.listDirectory(
      locationBasePath(profileId)
    );
    return entries;
  }

  async readLocation(
    profileId: string,
    repoId: string
  ): Promise<LocationInfo | undefined> {
    return this.read<LocationInfo>(locationInfoPath(profileId, repoId));
  }

  async writeLocation(profileId: string, locationInfo: LocationInfo) {
    await this.write(
      locationInfoPath(profileId, locationInfo.id),
      locationInfo
    );
  }

  async listSyncs(profileId: string): Promise<DirEntry[]> {
    const entries = await this.metaRepo.listDirectory(syncBasePath(profileId));
    return entries;
  }

  async writeSync(profileId: string, syncConfig: SyncConfig) {
    await this.write(syncInfoPath(profileId, syncConfig.id), syncConfig);
  }

  async readSync(
    profileId: string,
    syncId: string
  ): Promise<SyncConfig | undefined> {
    return this.read<SyncConfig>(syncInfoPath(profileId, syncId));
  }

  async snapshot() {
    await this.metaRepo.createSnapshot(new Date());
  }

  async createChild(profileId: string, repoName?: string): Promise<Repository> {
    const repoId = shortId();
    const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
    await Repository.create(repoId, this.ioConfig, this.storeGetter, key);
    const repo = Repository.open(repoId, this.ioConfig, this.storeGetter, {
      key,
      branch: "main",
      inlined: false,
    });

    await this.writeLocation(profileId, {
      id: repoId,
      type: "repository",
      encKey: key.toString("base64"),
      name: repoName,
    });

    // TODO move to separate method?
    await this.metaRepo.createSnapshot(new Date());
    return repo;
  }

  async openChild(
    profileId: string,
    repoId: string
  ): Promise<Repository | undefined> {
    const repoInfo = await this.readLocation(profileId, repoId);
    if (repoInfo?.type !== "repository") {
      return undefined;
    }
    const repo = Repository.open(repoId, this.ioConfig, this.storeGetter, {
      key: Buffer.from(repoInfo.encKey, "base64"),
      branch: "main",
      inlined: false,
    });
    return repo;
  }
}
