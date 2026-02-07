import p from "path";
import fs from "fs/promises";
import { BlobStore } from "lib";
import { existsSync } from "fs";

export class FileBlobStore implements BlobStore {
  constructor(private baseDir: string[]) {}

  private validatePath(path: string[]) {
    for (const p of path) {
      if (p === ".." || p === ".") {
        throw Error(`Invalid path: ${JSON.stringify(path)}`);
      }
    }
  }

  async list(path: string[]): Promise<string[]> {
    this.validatePath(path);
    const fullPath = p.join(...this.baseDir, ...path);
    const content = await fs.readdir(fullPath);
    return content;
  }
  async exists(path: string[]): Promise<boolean> {
    this.validatePath(path);
    const fullPath = p.join(...this.baseDir, ...path);
    return existsSync(fullPath);
  }
  read(path: string[]): Promise<Uint8Array> {
    this.validatePath(path);
    const fullPath = p.join(...this.baseDir, ...path);
    return fs.readFile(fullPath);
  }
  async write(path: string[], data: Uint8Array): Promise<void> {
    this.validatePath(path);
    const fullPathArray = [...this.baseDir, ...path];
    const fullPath = p.join(...fullPathArray);
    await fs.mkdir(p.join(...fullPathArray.slice(0, -1)), { recursive: true });
    return fs.writeFile(fullPath, data);
  }
}
