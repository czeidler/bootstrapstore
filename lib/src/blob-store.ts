export type BlobStore = {
  list(path: string[]): Promise<string[]>;
  read(path: string[]): Promise<Buffer>;
  write(path: string[], data: Buffer): Promise<void>;
};

export class RepoBlobStoreGetter {
  constructor(private parent: BlobStore) {}
  get(repoId: string): BlobStore {
    return new RepoBlobStore(this.parent, [repoId]);
  }
}

class RepoBlobStore implements BlobStore {
  constructor(private parent: BlobStore, private basePath: string[]) {}

  list(path: string[]): Promise<string[]> {
    return this.parent.list([...this.basePath, ...path]);
  }
  read(path: string[]): Promise<Buffer> {
    return this.parent.read([...this.basePath, ...path]);
  }
  write(path: string[], data: Buffer): Promise<void> {
    return this.parent.write([...this.basePath, ...path], data);
  }
}
