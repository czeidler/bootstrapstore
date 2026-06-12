import { BlobStoreGetter } from "./blob-store";
import { DirEntry, RepoIOConfig, Repository } from "./repository";
import {
  arrayToString,
  base64ToUint8Array,
  shortId,
  stringToUint8Array,
  uint8ArrayToBase64,
} from "./utils";

const deviceDir = "devices";
const devicePath = (deviceId: string) => [deviceDir, deviceId, "device.json"];
export type DeviceInfo = {
  id: string;
  name?: string;
  description?: string;
  machineId?: string;
};

// connection
const connectionsBasePath = (deviceId: string) => [
  deviceDir,
  deviceId,
  "connections",
];
const connectionsPath = (deviceId: string, connectionId: string) => [
  deviceDir,
  deviceId,
  "connections",
  connectionId,
  "connection.json",
];
export type ConnectionInfo = {
  id: string;
  type: "sftp";
  host: string;
  user: string;
  keyPem: string;
};
// location
const locationBasePath = (deviceId: string) => [
  deviceDir,
  deviceId,
  "locations",
];
const locationPath = (deviceId: string, locationId: string) => [
  deviceDir,
  deviceId,
  "locations",
  locationId,
  "location.json",
];
export type LocationInfo = RepositoryLocationInfo | DirectoryLocationInfo;
export type RepositoryLocationInfo = {
  /** The repo id */
  id: string;
  /** If undefined repo is stored in the default location */
  path?: string;
  type: "repository";
  encKey: string;
  name?: string;
};
export type DirectoryLocationInfo = {
  id: string;
  path: string;
  type: "directory";
};

//sync
const syncBasePath = (deviceId: string) => [deviceDir, deviceId, "syncs"];
const syncPath = (deviceId: string, syncId: string) => [
  deviceDir,
  deviceId,
  "syncs",
  syncId,
  "sync.json",
];

export type SyncRepoInfo = {
  id: string;
  type: "syncRepos";
  repoId: string;
  to: { path: string };
};
export type SyncPathInfo = {
  id: string;
  type: "cp";
  from: { path: string; remoteId?: string };
  to: { path: string; remoteId?: string };
};

export type SyncInfo = SyncRepoInfo | SyncPathInfo;

export class MetadataRepository {
  private constructor(
    public metaRepo: Repository,
    private storeGetter: BlobStoreGetter,
    private ioConfig: RepoIOConfig,
  ) {}

  static async open(
    repoId: string,
    storeGetter: BlobStoreGetter,
    ioConfig: RepoIOConfig,
    key: Uint8Array,
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
    ioConfig: RepoIOConfig,
  ): Promise<MetadataRepository> {
    const metaRepo = await repo.branch(".metadata", true);
    return new MetadataRepository(metaRepo, storeGetter, ioConfig);
  }

  private async write(path: string[], obj: object) {
    const now = Date.now();
    await this.metaRepo.insertFile(
      path,
      stringToUint8Array(JSON.stringify(obj)),
      now,
      now,
    );
  }

  private async read<T>(path: string[]): Promise<T | undefined> {
    const buf = await this.metaRepo.readFile(path);
    if (buf === undefined) {
      return undefined;
    }
    return JSON.parse(arrayToString(buf)) as T;
  }

  async addDevice(device: DeviceInfo) {
    await this.write(devicePath(device.id), device);
  }

  async listDevices(): Promise<DirEntry[]> {
    const entries = await this.metaRepo.listDirectory([deviceDir]);
    return entries;
  }

  async getDevice(deviceId: string): Promise<DeviceInfo | undefined> {
    return this.read<DeviceInfo>(devicePath(deviceId));
  }

  // connections
  async listConnections(deviceId: string): Promise<DirEntry[]> {
    const entries = await this.metaRepo.listDirectory(
      connectionsBasePath(deviceId),
    );
    return entries;
  }

  async readConnection(
    deviceId: string,
    connectionId: string,
  ): Promise<ConnectionInfo | undefined> {
    return this.read<ConnectionInfo>(connectionsPath(deviceId, connectionId));
  }

  async writeConnection(deviceId: string, connection: ConnectionInfo) {
    await this.write(connectionsPath(deviceId, connection.id), connection);
  }

  // locations
  async listLocations(deviceId: string): Promise<DirEntry[]> {
    const entries = await this.metaRepo.listDirectory(
      locationBasePath(deviceId),
    );
    return entries;
  }

  async readLocation(
    deviceId: string,
    locationId: string,
  ): Promise<LocationInfo | undefined> {
    return this.read<LocationInfo>(locationPath(deviceId, locationId));
  }

  async writeLocation(deviceId: string, locationInfo: LocationInfo) {
    await this.write(locationPath(deviceId, locationInfo.id), locationInfo);
  }

  async listSyncs(deviceId: string): Promise<DirEntry[]> {
    const entries = await this.metaRepo.listDirectory(syncBasePath(deviceId));
    return entries;
  }

  async writeSync(deviceId: string, syncConfig: SyncInfo) {
    await this.write(syncPath(deviceId, syncConfig.id), syncConfig);
  }

  async readSync(
    profileId: string,
    syncId: string,
  ): Promise<SyncInfo | undefined> {
    return this.read<SyncInfo>(syncPath(profileId, syncId));
  }

  async snapshot() {
    await this.metaRepo.createSnapshot(new Date());
  }

  async createChild(profileId: string, repoName?: string): Promise<Repository> {
    const repoId = shortId();
    const key = crypto.getRandomValues(new Uint8Array(16));
    await Repository.create(repoId, this.ioConfig, this.storeGetter, key);
    const repo = Repository.open(repoId, this.ioConfig, this.storeGetter, {
      key,
      branch: "main",
      inlined: false,
    });

    await this.writeLocation(profileId, {
      id: repoId,
      type: "repository",
      encKey: uint8ArrayToBase64(key),
      name: repoName,
    });

    // TODO move to separate method?
    await this.metaRepo.createSnapshot(new Date());
    return repo;
  }

  async openChild(
    deviceId: string,
    repoId: string,
  ): Promise<Repository | undefined> {
    const repoInfo = await this.readLocation(deviceId, repoId);
    if (repoInfo?.type !== "repository") {
      return undefined;
    }
    const repo = Repository.open(repoId, this.ioConfig, this.storeGetter, {
      key: base64ToUint8Array(repoInfo.encKey),
      branch: "main",
      inlined: false,
    });
    return repo;
  }
}
