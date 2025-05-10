import { Hash, HashPart, hashParts } from "./hasher";
import { TreeEntryType } from "./index-repository";

export type BlobInfo =
  | {
      type: "encrypted";
      encKey: Buffer;
      parts: Hash[];
    }
  | { type: "inlined"; parts: Buffer[] };

export type TreeLoader = {
  readTree(hash: DBHash): Promise<Tree>;
};

export type TreeWriter = {
  writeTree(
    treeHash: Hash,
    entries: { name: string; entry: BlobEntry | RepoLinkEntry | TreeEntry }[]
  ): Promise<DBHash>;
};

export type DBHash = [number, Buffer];

export type BlobEntry = {
  type: typeof TreeEntryType.Blob;
  hash: DBHash;
  size: number;
  creationTime: number;
  modificationTime: number;
};

export type RepoLinkEntry = {
  type: typeof TreeEntryType.RepoLink;
  repoId: string;
};

export type TreeEntry = {
  type: typeof TreeEntryType.Tree;
  hash: DBHash;
  /** When loaded */
  data: Tree | undefined;
};

export type MutatedTreeEntry = {
  type: "mutateTree";
  data: Tree;
};

export type Entry = BlobEntry | RepoLinkEntry | TreeEntry | MutatedTreeEntry;

export type Tree = {
  entries: Map<string, Entry>;
};
function entryToHashable(
  name: string,
  entry: BlobEntry | RepoLinkEntry | TreeEntry
): HashPart[] {
  const blob: HashPart[] =
    entry.type === TreeEntryType.Blob
      ? [
          {
            key: "h",
            value: entry.hash[1],
          },
          {
            key: "s",
            value: entry.size,
          },
          {
            key: "c",
            value: entry.creationTime,
          },
          {
            key: "m",
            value: entry.modificationTime,
          },
        ]
      : [];
  const repoLink: HashPart[] =
    entry.type === TreeEntryType.RepoLink
      ? [
          {
            key: "r",
            value: entry.repoId,
          },
        ]
      : [];
  const tree: HashPart[] =
    entry.type === TreeEntryType.Tree
      ? [
          {
            key: "h",
            value: entry.hash[1],
          },
        ]
      : [];
  return [
    {
      key: "n",
      value: name,
    },
    {
      key: "t",
      value: entry.type,
    },
    ...blob,
    ...repoLink,
    ...tree,
  ];
}

export class TreeBuilder {
  constructor(private root: Tree) {}

  async loadTree(
    loader: TreeLoader,
    dirPath: string[],
    {
      createMissingDirs,
      writeable,
    }: { createMissingDirs: boolean; writeable: boolean }
  ): Promise<Tree | string> {
    let tree: Tree = this.root;
    for (const p of dirPath) {
      const e = tree.entries.get(p);
      if (e === undefined) {
        if (!createMissingDirs) {
          return "Tree does not exit";
        }
        const newTree: Tree = { entries: new Map() };
        tree.entries.set(p, {
          type: "mutateTree",
          data: newTree,
        });
        tree = newTree;

        continue;
      }
      if (e.type === TreeEntryType.Tree) {
        let t;
        if (!e.data) {
          t = await loader.readTree(e.hash);
          e.data = t;
        } else {
          t = e.data;
        }

        // mark the entry as dirty
        if (writeable) {
          tree.entries.set(p, {
            type: "mutateTree",
            data: t,
          });
        }

        tree = t;
      } else if (e.type === "mutateTree") {
        tree = e.data;
      } else {
        return "Path does not point to a tree";
      }
    }
    return tree;
  }

  async insertEntry(
    loader: TreeLoader,
    path: string[],
    blob: BlobEntry | RepoLinkEntry
  ) {
    const tree = await this.loadTree(loader, path.slice(0, -1), {
      createMissingDirs: true,
      writeable: true,
    });
    if (typeof tree === "string") {
      throw Error(tree);
    }
    const name = path.at(path.length - 1);
    if (name === undefined) {
      throw Error("Invalid path");
    }
    tree.entries.set(name, blob);
  }

  async deleteEntry(loader: TreeLoader, path: string[]) {
    const tree = await this.loadTree(loader, path.slice(0, -1), {
      createMissingDirs: false,
      writeable: true,
    });
    if (typeof tree === "string") {
      throw Error(tree);
    }
    const name = path.at(path.length - 1);
    if (name === undefined) {
      throw Error("Invalid path");
    }
    tree.entries.delete(name);
  }

  async readBlob(
    loader: TreeLoader,
    path: string[]
  ): Promise<BlobEntry | undefined> {
    const tree = await this.loadTree(loader, path.slice(0, -1), {
      createMissingDirs: false,
      writeable: false,
    });
    if (typeof tree === "string") {
      return undefined;
    }
    const file = tree.entries.get(path[path.length - 1]);
    if (file === undefined) {
      return undefined;
    }
    if (file.type !== TreeEntryType.Blob) {
      throw Error("Path points to a directory and not to a file");
    }
    return file;
  }

  async readRepoLink(
    loader: TreeLoader,
    path: string[]
  ): Promise<RepoLinkEntry | undefined> {
    const tree = await this.loadTree(loader, path.slice(0, -1), {
      createMissingDirs: false,
      writeable: true,
    });
    if (typeof tree === "string") {
      return undefined;
    }
    const repoLink = tree.entries.get(path[path.length - 1]);
    if (repoLink === undefined) {
      return undefined;
    }
    if (repoLink.type !== TreeEntryType.RepoLink) {
      throw Error("Path points to a directory and not to a file");
    }
    return repoLink;
  }

  async finalize(writer: TreeWriter): Promise<DBHash> {
    return TreeBuilder.finalizeTree(writer, this.root);
  }

  private static async finalizeTree(
    writer: TreeWriter,
    tree: Tree
  ): Promise<DBHash> {
    const entries = Array.from(tree.entries.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const finalizedEntries: {
      name: string;
      entry: BlobEntry | RepoLinkEntry | TreeEntry;
    }[] = [];
    for (const [name, entry] of entries) {
      switch (entry.type) {
        case TreeEntryType.Blob:
        case TreeEntryType.RepoLink:
        case TreeEntryType.Tree:
          finalizedEntries.push({ name, entry });
          break;
        case "mutateTree": {
          const entryDataHash = await TreeBuilder.finalizeTree(
            writer,
            entry.data
          );
          const finalizedEntry: TreeEntry = {
            type: TreeEntryType.Tree,
            data: entry.data,
            hash: entryDataHash,
          };
          tree.entries.set(name, finalizedEntry);
          finalizedEntries.push({ name, entry: finalizedEntry });
          break;
        }
        default:
          ((_: never) => {})(entry);
          throw Error();
      }
    }

    const entryHashParts = finalizedEntries.reduce<HashPart[]>((prev, cur) => {
      prev.push(...entryToHashable(cur.name, cur.entry));
      return prev;
    }, []);
    const hash = await hashParts(entryHashParts);
    const dbHash = await writer.writeTree(hash, finalizedEntries);
    return dbHash;
  }
}
