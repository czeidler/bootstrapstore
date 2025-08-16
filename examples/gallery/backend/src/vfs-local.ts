import { readdir, readFile, stat } from "fs/promises";
import { VFSDir, VFSEntry, VFSFile } from "lib";
import path from "path";

export class LocalFile implements VFSFile {
  constructor(private path: string) {}
  read(): Promise<Buffer> {
    return readFile(this.path);
  }
  async stats(): Promise<{
    size: number;
    creationTime: number;
    modificationTime: number;
  }> {
    const s = await stat(this.path);
    return {
      size: s.size,
      creationTime: s.ctimeMs,
      modificationTime: s.mtimeMs,
    };
  }
}

export class LocalDir implements VFSDir {
  constructor(private path: string) {}

  async list(): Promise<VFSEntry[]> {
    const content = await readdir(this.path, { withFileTypes: true });
    return content
      .map((entry) => {
        const entryPath = path.join(this.path, entry.name);
        if (entry.isFile()) {
          return {
            type: "file",
            name: entry.name,
            content: new LocalFile(entryPath),
          } satisfies VFSEntry;
        }
        if (entry.isDirectory()) {
          return {
            type: "dir",
            name: entry.name,
            content: new LocalDir(entryPath),
          } satisfies VFSEntry;
        }
        return undefined;
      })
      .filter((it) => it !== undefined);
  }
}
