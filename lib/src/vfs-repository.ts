import { MetadataRepository } from "./main-repo";
import { Repository } from "./repository";
import { ExhaustiveCheckError } from "./utils";
import { VFSDir, VFSEntry, VFSFile } from "./vfs";

class RepoFile implements VFSFile {
  constructor(
    private repo: Repository,
    private path: string[],
    private file: {
      size: number;
      creationTime: number;
      modificationTime: number;
    }
  ) {}

  async read(): Promise<Buffer> {
    const content = await this.repo.readFile(this.path);
    if (content === undefined) {
      throw Error("Failed to read file content");
    }
    return content;
  }

  async stats(): Promise<{
    size: number;
    creationTime: number;
    modificationTime: number;
  }> {
    return this.file;
  }
}

class ChildRepoDir implements VFSDir {
  private repo: Repository | undefined;

  constructor(
    private metadataRepo: MetadataRepository,
    private repoId: string
  ) {}

  private async getRepo(): Promise<Repository> {
    if (this.repo) {
      return this.repo;
    }

    // TODO handle default profileId:
    const child = await this.metadataRepo.openChild("default", this.repoId);
    if (child === undefined) {
      throw Error(`Can't open repo`);
    }
    this.repo = child;
    return child;
  }

  async list(): Promise<VFSEntry[]> {
    const repo = await this.getRepo();
    return new RepoDir(repo, this.metadataRepo, []).list();
  }
}

class RepoDir implements VFSDir {
  constructor(
    private repo: Repository,
    private metadataRepo: MetadataRepository,
    private path: string[]
  ) {}

  async list(): Promise<VFSEntry[]> {
    const content = await this.repo.listDirectory(this.path);
    return content.map((it) => {
      switch (it.type) {
        case "file":
          return {
            type: "file",
            name: it.name,
            content: new RepoFile(this.repo, [...this.path, it.name], it),
          };
        case "dir":
          return {
            type: "dir",
            name: it.name,
            content: new RepoDir(this.repo, this.metadataRepo, [
              ...this.path,
              it.name,
            ]),
          };
        case "repo":
          return {
            type: "repo",
            name: it.name,
            content: new ChildRepoDir(this.metadataRepo, it.repoId),
          };
        default:
          throw new ExhaustiveCheckError(it);
      }
    });
  }
}

export function rootDir(
  repository: Repository,
  metadataRepo: MetadataRepository
): VFSDir {
  return new RepoDir(repository, metadataRepo, []);
}
