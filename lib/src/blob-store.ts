export type BlobStore = {
  list(path: string[]): Promise<string[]>;
  read(path: string[]): Promise<Buffer>;
  write(path: string[], data: Buffer): Promise<void>;
};
