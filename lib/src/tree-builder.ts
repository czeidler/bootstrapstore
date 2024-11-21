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

export type Hash = Buffer;
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

type HashPart = { key: string; value: Buffer | string };

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

async function hashParts(parts: HashPart[]): Promise<Hash> {
  const all = parts.reduce<Buffer[]>((prev, cur) => {
    prev.push(Buffer.from(cur.key, "utf8"));
    if (typeof cur.value === "string") {
      prev.push(Buffer.from(cur.key, "utf8"));
    } else {
      prev.push(cur.value);
    }
    return prev;
  }, []);
  const hashArray = await crypto.subtle.digest("SHA-256", Buffer.concat(all));
  const hash = Buffer.from(hashArray);
  return hash;
}

export class TreeBuilder {
  static async insertBlob(
    loader: TreeLoader,
    root: Tree,
    path: string[],
    blob: BlobEntry
  ) {
    let tree: Tree = root;
    for (const p of path.slice(0, -1)) {
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
    const name = path[path.length - 1];
    if (name === undefined) {
      throw Error("Invalid path");
    }
    tree.entries.set(name, blob);
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
        case "mutateTree":
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
