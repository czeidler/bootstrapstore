export type BlobStore = {
  list(path: string[]): Promise<string[]>;
  exists(path: string[]): Promise<boolean>;
  read(path: string[]): Promise<Buffer>;
  write(path: string[], data: Buffer): Promise<void>;
};

export interface BlobStoreGetter {
  get(repoId: string | undefined): BlobStore;
}

export class RepoBlobStoreGetter implements BlobStoreGetter {
  constructor(private parent: BlobStore) {}
  get(repoId: string | undefined): BlobStore {
    if (repoId !== undefined) {
      if (repoId === ".main") {
        throw Error("Invalid repoId: .main");
      }
      return new RepoBlobStore(this.parent, ["repos", repoId]);
    }
    return new RepoBlobStore(this.parent, ["repos", ".main"]);
  }
}

class RepoBlobStore implements BlobStore {
  constructor(private parent: BlobStore, private basePath: string[]) {}

  list(path: string[]): Promise<string[]> {
    return this.parent.list([...this.basePath, ...path]);
  }
  exists(path: string[]): Promise<boolean> {
    return this.parent.exists([...this.basePath, ...path]);
  }
  read(path: string[]): Promise<Buffer> {
    return this.parent.read([...this.basePath, ...path]);
  }
  write(path: string[], data: Buffer): Promise<void> {
    return this.parent.write([...this.basePath, ...path], data);
  }
}
