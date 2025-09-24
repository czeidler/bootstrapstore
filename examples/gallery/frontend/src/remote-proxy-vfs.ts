import {
  ExhaustiveCheckError,
  RemoteInfo,
  VFSDir,
  VFSEntry,
  VFSFile,
} from "lib";
import { trustedTsr } from "./tsr";

class RemoteProxyFileVFS implements VFSFile {
  constructor(
    private remote: RemoteInfo,
    private path: string[],
    private fileStats: {
      size: number;
      creationTime: number;
      modificationTime: number;
    }
  ) {}

  read(): Promise<Buffer> {
    throw new Error("Method not implemented.");
  }

  async stats(): Promise<{
    size: number;
    creationTime: number;
    modificationTime: number;
  }> {
    return {
      size: this.fileStats.size,
      creationTime: this.fileStats.creationTime,
      modificationTime: this.fileStats.modificationTime,
    };
  }
}

export class RemoteProxyDirVFS implements VFSDir {
  constructor(private remote: RemoteInfo, private path: string[]) {}

  async list(): Promise<VFSEntry[]> {
    const result = await trustedTsr.ls.mutate({
      body: { remote: this.remote, path: this.path.join("/") },
    });
    if (result.status !== 201) {
      throw new Error(`Network error`);
    }
    return result.body.entries.map((it) => {
      const entryPath = [...this.path, it.name];
      switch (it.type) {
        case "dir": {
          return {
            type: "dir",
            name: it.name,
            content: new RemoteProxyDirVFS(this.remote, entryPath),
          } satisfies VFSEntry;
        }
        case "file": {
          return {
            type: "file",
            name: it.name,
            content: new RemoteProxyFileVFS(this.remote, entryPath, it),
          } satisfies VFSEntry;
        }
        default:
          throw new ExhaustiveCheckError(it);
      }
    });
  }
}
