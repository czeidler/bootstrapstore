import p from "path";
import fs from "fs/promises";

export type BlobStore = {
  list(path: string[]): Promise<string[]>;
  read(path: string[]): Promise<Buffer>;
  write(path: string[], data: Buffer): Promise<void>;
};

export class FileBlobStore implements BlobStore {
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
  async write(path: string[], data: Buffer): Promise<void> {
    const fullPathArray = [...this.baseDir, ...path];
    const fullPath = p.join(...fullPathArray);
    await fs.mkdir(p.join(...fullPathArray.slice(0, -1)), { recursive: true });
    return fs.writeFile(fullPath, data);
  }
}
