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
import { bufferToHex } from "./utils";

type EncryptedBlobInfoReader = {
  readBlobInfo(plainBlobHash: Hash): Promise<BlobInfo>;
};

type EncryptedBlobInfoWriter = {
  /** User has to make sure that there isn't already an entry for the plain blob
   * @returns the DBHash of the inserted plain blob
   */
  writeBlobInfo(
    plainBlobHash: Hash,
    encryptedBlobInfo: BlobInfo
  ): Promise<DBHash>;
};

type Snapshot = {
  hash256: Hash;
  tree: DBHash;
  timestamp: Date;
  parents: string[];
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

  async readTree(hash: DBHash): Promise<Tree> {
    const result = await this.db
      .selectFrom("tree_entry")
      .innerJoin("content", "content.id", "tree_entry.content_id")
      .selectAll("tree_entry")
      .select("content.hash265")
      .where("tree_entry.tree_id", "=", hash[0])
      .execute();
    const entries = result.reduce((prev, cur) => {
      const hash: [number, Buffer] = [Number(cur.content_id), cur.hash265];
      if (cur.type === TreeEntryType.Blob) {
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
    entries: { name: string; entry: BlobEntry | RepoLinkEntry | TreeEntry }[]
  ): Promise<DBHash> {
    const result = await this.db
      .insertInto("content")
      .values({ hash265: treeHash })
      .executeTakeFirst();
    const treeDBHash = [Number(result.insertId), treeHash] as DBHash;
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
            content_id: entry.entry.hash[0],
          };
        }
        default: {
          const exhaustiveCheck: never = entry.entry;
          throw Error(`Unknown entry type ${exhaustiveCheck}`);
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
      .where("content.hash265", "=", hash)
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
      .where("content.hash265", "=", plainBlobHash)
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
    blobInfo: BlobInfo
  ): Promise<DBHash> {
    const contentResult = await this.db
      .insertInto("content")
      .values({ hash265: plainBlobHash })
      .executeTakeFirst();
    const contentId = Number(contentResult.insertId);

    const result = await this.db
      .insertInto("blob")
      .values({
        content_id: contentId,
        enc_key: blobInfo.type === "encrypted" ? blobInfo.encKey : undefined,
      })
      .executeTakeFirst();
    const blob_id = Number(result.insertId);
    await this.db
      .insertInto("blob_part")
      .values(
        blobInfo.type === "encrypted"
          ? blobInfo.parts.map((it, i) => ({
              blob_id,
              key: it,
              index: i,
            }))
          : blobInfo.parts.map((it, i) => ({
              blob_id,
              data: it,
              index: i,
            }))
      )
      .execute();
    return [contentId, plainBlobHash];
  }

  async readLatestSnapshot(branch: string): Promise<Snapshot | undefined> {
    const data = await this.db
      .selectFrom("commit")
      .innerJoin("branch", "branch.commit_id", "commit.id")
      .innerJoin("content", "commit.tree_content_id", "content.id")
      .selectAll("commit")
      .select("content.hash265 as treeHash")
      .where("branch.name", "=", branch)
      .executeTakeFirst();
    if (data === undefined) {
      return undefined;
    }
    return {
      hash256: data.hash256,
      tree: [data.tree_content_id, data.treeHash],
      timestamp: new Date(data.timestamp),
      parents: JSON.parse(data.parents) as string[],
    };
  }

  async writeSnapshot(
    tree: DBHash,
    timestamp: Date,
    parents: Hash[],
    branch: string
  ) {
    const snapshotHash = await hashParts([
      { key: "t", value: tree[1] },
      { key: "ts", value: timestamp },
      ...parents.map((it) => ({ key: "p", value: it })),
    ]);
    const result = await this.db
      .insertInto("commit")
      .values({
        hash256: snapshotHash,
        tree_content_id: tree[0],
        timestamp: timestamp.getTime(),
        parents: JSON.stringify(parents.map((it) => bufferToHex(it))),
      })
      .executeTakeFirst();
    const commitId = Number(result.insertId);
    await this.db
      .insertInto("branch")
      .values({ commit_id: commitId, name: branch })
      .onConflict((oc) =>
        oc
          .column("name")
          .doUpdateSet({ commit_id: commitId })
          .where("name", "=", branch)
      )
      .execute();
  }
}
