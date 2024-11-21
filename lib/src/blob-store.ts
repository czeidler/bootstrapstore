import { IndexRepository } from "./index-repository";
import p from "path";
import fs from "fs/promises";

export type BlobStore = {
  list(path: string[]): Promise<string[]>;
  read(path: string[]): Promise<Buffer>;
  write(path: string[], data: Buffer): Promise<void>;
};

class FileBlobStore implements BlobStore {
  constructor(private baseDir: string[]) {}
  async list(path: string[]): Promise<string[]> {
    const fullPath = p.join(...this.baseDir, ...path);
    const content = await fs.readdir(fullPath);
    return content;
  }
  read(path: string[]): Promise<Buffer> {
    const fullPath = p.join(...this.baseDir, ...path);
    return fs.readFile(fullPath);
  }
  write(path: string[], data: Buffer): Promise<void> {
    const fullPath = p.join(...this.baseDir, ...path);
    return fs.writeFile(fullPath, data);
  }
}
