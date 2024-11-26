import { Hash, HashPart, hashParts } from "./hasher";

export type EncryptedBlobInfo = {
  key: Buffer;
  encryptedParts: Hash[];
};

export type TreeLoader = {
  readTree(hash: DBHash): Promise<Tree>;
};

export type TreeWriter = {
  writeTree(
    treeHash: Hash,
    entries: { name: string; entry: BlobEntry | TreeEntry }[]
  ): Promise<DBHash>;
};

export type DBHash = [number, Buffer];

export type BlobEntry = {
  type: "blob";
  hash: DBHash;
};

export type TreeEntry = {
  type: "tree";
  hash: DBHash;
  /** When loaded */
  data: Tree | undefined;
};

export type MutatedTreeEntry = {
  type: "mutateTree";
  data: Tree;
  hash: Hash | undefined;
};

export type Entry = BlobEntry | TreeEntry | MutatedTreeEntry;

export type Tree = {
  entries: Map<string, Entry>;
};
function entryToHashable(
  name: string,
  entry: BlobEntry | TreeEntry
): HashPart[] {
  return [
    {
      key: "n",
      value: name,
    },
    {
      key: "h",
      value: entry.hash[1],
    },
  ];
}

export class TreeBuilder {
  static async loadTree(
    loader: TreeLoader,
    root: Tree,
    dirPath: string[]
  ): Promise<Tree> {
    let tree: Tree = root;
    for (const p of dirPath) {
      const e = root.entries.get(p);
      if (e === undefined) {
        const newTree: Tree = { entries: new Map() };
        tree.entries.set(p, {
          type: "mutateTree",
          data: newTree,
          hash: undefined,
        });
        tree = newTree;
        continue;
      }
      if (e.type === "tree") {
        if (!e.data) {
          const t = await loader.readTree(e.hash);
          e.data = t;
          tree = t;
        } else {
          tree = e.data;
        }
      } else if (e.type === "mutateTree") {
        tree = e.data;
      } else {
        throw Error("Invalid path");
      }
      // mark the entry as dirty
      tree.entries.set(p, {
        type: "mutateTree",
        data: tree,
        hash: undefined,
      });
    }
    return tree;
  }

  static async insertBlob(
    loader: TreeLoader,
    root: Tree,
    path: string[],
    blob: BlobEntry
  ) {
    const tree = await TreeBuilder.loadTree(loader, root, path.slice(0, -1));
    const name = path[path.length - 1];
    if (name === undefined) {
      throw Error("Invalid path");
    }
    tree.entries.set(name, blob);
  }

  static async readBlob(
    loader: TreeLoader,
    root: Tree,
    path: string[]
  ): Promise<BlobEntry | undefined> {
    const tree = await TreeBuilder.loadTree(loader, root, path.slice(0, -1));
    const file = tree.entries.get(path[path.length - 1]);
    if (file === undefined) {
      return undefined;
    }
    if (file.type !== "blob") {
      throw Error("Path points to a directory and not to a file");
    }
    return file;
  }

  static async finalizeTree(writer: TreeWriter, tree: Tree): Promise<DBHash> {
    const entries = Array.from(tree.entries.entries()).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    const finalizedEntries: { name: string; entry: BlobEntry | TreeEntry }[] =
      [];
    for (const [name, entry] of entries) {
      switch (entry.type) {
        case "blob":
        case "tree":
          finalizedEntries.push({ name, entry });
          break;
        case "mutateTree": {
          const entryDataHash = await TreeBuilder.finalizeTree(
            writer,
            entry.data
          );
          const finalizedEntry: TreeEntry = {
            type: "tree",
            data: entry.data,
            hash: entryDataHash,
          };
          tree.entries.set(name, finalizedEntry);
          finalizedEntries.push({ name, entry: finalizedEntry });
          break;
        }
        default:
          throw ((_: never) => {})(entry);
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
