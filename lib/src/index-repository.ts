import { Kysely } from "kysely";
import { DB } from "./db/db";
import {
  BlobEntry,
  DBHash,
  BlobInfo,
  Tree,
  TreeEntry,
  TreeLoader,
  TreeWriter,
  RepoLinkEntry,
} from "./tree-builder";
import { Hash, hashParts } from "./hasher";
import { arrayToHex, ExhaustiveCheckError } from "./utils";

type EncryptedBlobInfoReader = {
  readBlobInfo(plainBlobHash: Hash): Promise<BlobInfo>;
};

type EncryptedBlobInfoWriter = {
  /** User has to make sure that there isn't already an entry for the plain blob
   * @returns the DBHash of the inserted plain blob
   */
  writeBlobInfo(
    plainBlobHash: Hash,
    encryptedBlobInfo: BlobInfo,
  ): Promise<DBHash>;
};

export type Snapshot = {
  hash256: Hash;
  /** If undefined it points to an empty directory */
  tree: DBHash | undefined;
  timestamp: Date;
  parents: string[];
};

const arrayToBuffer = (array: Uint8Array) => {
  const buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  return buffer;
};

export const TreeEntryType = {
  Blob: "b",
  RepoLink: "r",
  Tree: "t",
} as const;

export class IndexRepository
  implements
    TreeLoader,
    TreeWriter,
    EncryptedBlobInfoReader,
    EncryptedBlobInfoWriter
{
  constructor(private db: Kysely<DB>) {}

  async readTree(dbHash: DBHash): Promise<Tree> {
    const result = await this.db
      .selectFrom("tree_entry")
      .leftJoin("content", "content.id", "tree_entry.content_id")
      .selectAll("tree_entry")
      .select("content.hash265")
      .where("tree_entry.tree_id", "=", dbHash[0])
      .execute();
    const entries = result.reduce((prev, cur) => {
      if (cur.type === TreeEntryType.Blob) {
        if (cur.hash265 === null) {
          throw Error("Missing entry hash value");
        }
        const hash: [number, Uint8Array] = [
          Number(cur.content_id),
          cur.hash265,
        ];
        prev.set(cur.name, {
          type: TreeEntryType.Blob,
          hash,
          size: cur.size ?? 0,
          creationTime: cur.creation_time ?? 0,
          modificationTime: cur.modification_time ?? 0,
        });
      } else if (cur.type === TreeEntryType.RepoLink) {
        prev.set(cur.name, {
          type: TreeEntryType.RepoLink,
          repoId: cur.link ?? "",
        });
      } else if (cur.type === TreeEntryType.Tree) {
        const hash: [number, Uint8Array] | undefined =
          cur.hash265 !== null
            ? [Number(cur.content_id), cur.hash265]
            : undefined;
        prev.set(cur.name, {
          type: TreeEntryType.Tree,
          hash,
          data: undefined,
        });
      } else {
        throw Error("Invalid tree entry type");
      }
      return prev;
    }, new Map<string, BlobEntry | RepoLinkEntry | TreeEntry>());
    return {
      entries,
    };
  }

  async writeTree(
    treeHash: Hash,
    entries: { name: string; entry: BlobEntry | RepoLinkEntry | TreeEntry }[],
  ): Promise<DBHash> {
    const result = await this.db
      .insertInto("content")
      .values({ hash265: arrayToBuffer(treeHash) })
      .returning("id as id")
      .executeTakeFirst();
    if (result?.id === undefined) {
      throw Error("Missing insert it");
    }
    const treeDBHash = [result.id, treeHash] as DBHash;
    const mapEntry = (entry: {
      name: string;
      entry: BlobEntry | RepoLinkEntry | TreeEntry;
    }) => {
      switch (entry.entry.type) {
        case TreeEntryType.Blob: {
          return {
            name: entry.name,
            tree_id: treeDBHash[0],
            type: TreeEntryType.Blob,
            content_id: entry.entry.hash[0],
            size: entry.entry.size,
            creation_time: entry.entry.creationTime,
            modification_time: entry.entry.modificationTime,
          };
        }
        case TreeEntryType.RepoLink: {
          return {
            name: entry.name,
            tree_id: treeDBHash[0],
            type: TreeEntryType.RepoLink,
            link: entry.entry.repoId,
          };
        }
        case TreeEntryType.Tree: {
          return {
            name: entry.name,
            tree_id: treeDBHash[0],
            type: TreeEntryType.Tree,
            content_id: entry.entry.hash?.[0] ?? null,
          };
        }
        default: {
          throw new ExhaustiveCheckError(entry.entry);
        }
      }
    };
    await this.db
      .insertInto("tree_entry")
      .values(entries.map(mapEntry))
      .execute();
    return treeDBHash;
  }

  /** Test if blob exists */
  async readContent(hash: Hash): Promise<DBHash | undefined> {
    const id = await this.db
      .selectFrom("content")
      .select("id")
      .where("content.hash265", "=", arrayToBuffer(hash))
      .executeTakeFirst();
    if (!id?.id) {
      return undefined;
    }
    return [id.id, hash];
  }

  async readBlobInfo(plainBlobHash: Hash): Promise<BlobInfo> {
    const enc_blob = await this.db
      .selectFrom("blob")
      .select(["blob.id", "blob.enc_key"])
      .innerJoin("content", "content.id", "blob.content_id")
      .where("content.hash265", "=", arrayToBuffer(plainBlobHash))
      .executeTakeFirstOrThrow();
    const blobParts = await this.db
      .selectFrom("blob_part")
      .select(["blob_part.key", "blob_part.data"])
      .where("blob_part.blob_id", "=", enc_blob.id)
      .orderBy("blob_part.index asc")
      .execute();
    if (enc_blob.enc_key) {
      return {
        type: "encrypted",
        encKey: enc_blob.enc_key,
        parts: blobParts.map((it) => {
          if (it.key === null) {
            throw Error("Key part expected!");
          }
          return it.key;
        }),
      };
    } else {
      return {
        type: "inlined",
        parts: blobParts.map((it) => {
          if (it.data === null) {
            throw Error("Data part expected!");
          }
          return it.data;
        }),
      };
    }
  }

  async writeBlobInfo(
    plainBlobHash: Hash,
    blobInfo: BlobInfo,
  ): Promise<DBHash> {
    const contentResult = await this.db
      .insertInto("content")
      .values({ hash265: arrayToBuffer(plainBlobHash) })
      .returning("id as id")
      .executeTakeFirst();
    const contentId = contentResult?.id;
    if (contentId === undefined) {
      throw Error("Missing insert id");
    }

    const result = await this.db
      .insertInto("blob")
      .values({
        content_id: contentId,
        enc_key:
          blobInfo.type === "encrypted"
            ? arrayToBuffer(blobInfo.encKey)
            : undefined,
      })
      .returning("id as id")
      .executeTakeFirst();
    const blob_id = result?.id;
    if (blob_id === undefined) {
      throw Error("Missing insert id");
    }
    await this.db
      .insertInto("blob_part")
      .values(
        blobInfo.type === "encrypted"
          ? blobInfo.parts.map((it, i) => ({
              blob_id,
              key: arrayToBuffer(it),
              index: i,
            }))
          : blobInfo.parts.map((it, i) => ({
              blob_id,
              data: arrayToBuffer(it),
              index: i,
            })),
      )
      .execute();
    return [contentId, plainBlobHash];
  }

  async listCommits(limit?: number): Promise<Snapshot[]> {
    let query = this.db
      .selectFrom("commit")
      .leftJoin("content", "commit.tree_content_id", "content.id")
      .selectAll("commit")
      .select("content.hash265 as treeHash");
    if (limit !== undefined) {
      query = query.limit(limit);
    }
    const data = await query.execute();
    return data.map((it) => ({
      hash256: it.hash256,
      tree:
        it.tree_content_id !== null && it.treeHash !== null
          ? [it.tree_content_id, it.treeHash]
          : undefined,
      timestamp: new Date(it.timestamp),
      parents: JSON.parse(it.parents) as string[],
    }));
  }

  /**
   * If no snapshotHash256 is specified the latest snapshot is returned
   */
  async readSnapshot(snapshotHash256: Hash): Promise<Snapshot | undefined> {
    const data = await this.db
      .selectFrom("commit")
      .leftJoin("content", "commit.tree_content_id", "content.id")
      .selectAll("commit")
      .select("content.hash265 as treeHash")
      .where("commit.hash256", "=", arrayToBuffer(snapshotHash256))
      .orderBy("timestamp", "desc")
      .limit(1)
      .executeTakeFirst();
    if (data === undefined) {
      return undefined;
    }
    return {
      hash256: data.hash256,
      tree:
        data.tree_content_id !== null && data.treeHash !== null
          ? [data.tree_content_id, data.treeHash]
          : undefined,
      timestamp: new Date(data.timestamp),
      parents: JSON.parse(data.parents) as string[],
    };
  }

  /**
   * If no snapshotHash256 is specified the latest snapshot is returned
   */
  async readBranchHead(branch: string): Promise<Snapshot | undefined> {
    const data = await this.db
      .selectFrom("commit")
      .innerJoin("branch", "branch.commit_id", "commit.id")
      .leftJoin("content", "commit.tree_content_id", "content.id")
      .selectAll("commit")
      .select("content.hash265 as treeHash")
      .where("branch.name", "=", branch)
      .orderBy("timestamp", "desc")
      .limit(1)
      .executeTakeFirst();
    if (data === undefined) {
      return undefined;
    }
    return {
      hash256: data.hash256,
      tree:
        data.tree_content_id !== null && data.treeHash !== null
          ? [data.tree_content_id, data.treeHash]
          : undefined,
      timestamp: new Date(data.timestamp),
      parents: JSON.parse(data.parents) as string[],
    };
  }

  async writeSnapshot(
    tree: DBHash | undefined,
    timestamp: Date,
    parents: Hash[],
    branch: string,
  ): Promise<Hash> {
    const snapshotHash = await hashParts([
      { key: "t", value: tree?.[1] ?? "" },
      { key: "ts", value: timestamp },
      ...parents.map((it) => ({ key: "p", value: it })),
    ]);
    const result = await this.db
      .insertInto("commit")
      .values({
        hash256: arrayToBuffer(snapshotHash),
        tree_content_id: tree?.[0],
        timestamp: timestamp.getTime(),
        parents: JSON.stringify(parents.map((it) => arrayToHex(it))),
      })
      .returning("id as id")
      .executeTakeFirst();
    const commitId = result?.id;
    if (commitId === undefined) {
      throw Error("Missing insert id");
    }
    await this.db
      .insertInto("branch")
      .values({ commit_id: commitId, name: branch })
      .onConflict((oc) =>
        oc
          .column("name")
          .doUpdateSet({ commit_id: commitId })
          .where("name", "=", branch),
      )
      .execute();

    return snapshotHash;
  }
}
