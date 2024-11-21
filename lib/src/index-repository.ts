import { Kysely } from "kysely";
import { DB } from "./db/db";
import {
  BlobEntry,
  DBHash,
  EncryptedBlobInfo,
  Hash,
  Tree,
  TreeEntry,
  TreeLoader,
  TreeWriter,
} from "./tree-builder";

type EncryptedBlobInfoReader = {
  readEncryptedBlobInfo(plainBlobHash: Hash): Promise<EncryptedBlobInfo>;
};

type EncryptedBlobInfoWriter = {
  /** User has to make sure that there isn't already an entry for the plain blob
   * @returns the DBHash of the inserted plain blob
   */
  writeEncryptedBlobInfo(
    plainBlobHash: Hash,
    encryptedBlobInfo: EncryptedBlobInfo
  ): Promise<DBHash>;
};

type Snapshot = {
  tree: DBHash;
  timestamp: Date;
  parents: string[];
};

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
      .innerJoin("content", "content.id", "tree_entry.blob_id")
      .selectAll("tree_entry")
      .select("content.hash265")
      .where("tree_entry.tree_id", "=", hash[0])
      .execute();
    const entries = result.reduce((prev, cur) => {
      const hash: [number, Buffer] = [Number(cur.id), cur.hash265];
      if (cur.type === "b") {
        prev.set(cur.name, {
          type: "blob",
          hash,
        });
      } else if (cur.type === "t") {
        prev.set(cur.name, {
          type: "tree",
          hash,
          data: undefined,
        });
      } else {
        throw Error("Invalid tree entry type");
      }
      return prev;
    }, new Map<string, BlobEntry | TreeEntry>());
    return {
      entries,
    };
  }

  async writeTree(
    treeHash: Hash,
    entries: { name: string; entry: BlobEntry | TreeEntry }[]
  ): Promise<DBHash> {
    const result = await this.db
      .insertInto("content")
      .values({ hash265: treeHash })
      .executeTakeFirst();
    const treeDBHash = [Number(result.insertId), treeHash] as DBHash;
    await this.db
      .insertInto("tree_entry")
      .values(
        entries.map((it) => ({
          name: it.name,
          tree_id: treeDBHash[0],
          type: it.entry.type === "blob" ? "b" : "t",
          blob_id: it.entry.hash[0],
        }))
      )
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

  async readEncryptedBlobInfo(plainBlobHash: Hash): Promise<EncryptedBlobInfo> {
    const enc_blob = await this.db
      .selectFrom("enc_blob")
      .select(["enc_blob.id", "enc_blob.key"])
      .innerJoin("content", "content.id", "enc_blob.content_id")
      .where("content.hash265", "=", plainBlobHash)
      .executeTakeFirstOrThrow();
    const parts = await this.db
      .selectFrom("enc_blob_part")
      .select(["enc_blob_part.hash"])
      .where("enc_blob_part.enc_blob_id", "=", enc_blob.id)
      .orderBy("enc_blob_part.index asc")
      .execute();
    return {
      key: enc_blob.key,
      encryptedParts: parts.map((it) => it.hash),
    };
  }

  async writeEncryptedBlobInfo(
    plainBlobHash: Hash,
    encryptedBlobInfo: EncryptedBlobInfo
  ): Promise<DBHash> {
    const contentResult = await this.db
      .insertInto("content")
      .values({ hash265: plainBlobHash })
      .executeTakeFirst();
    const contentId = Number(contentResult.insertId);

    const result = await this.db
      .insertInto("enc_blob")
      .values({
        content_id: contentId,
        key: encryptedBlobInfo.key,
      })
      .executeTakeFirst();
    const enc_blob_id = Number(result.insertId);
    await this.db
      .insertInto("enc_blob_part")
      .values(
        encryptedBlobInfo.encryptedParts.map((it, i) => ({
          enc_blob_id,
          hash: it,
          index: i,
        }))
      )
      .execute();
    return [contentId, plainBlobHash];
  }

  async readLatestSnapshot(): Promise<Snapshot | undefined> {
    const data = await this.db
      .selectFrom("snapshot")
      .innerJoin("content", "snapshot.tree_content_id", "content.id")
      .selectAll("snapshot")
      .select("content.hash265")
      .orderBy("snapshot.id desc")
      .limit(1)
      .executeTakeFirst();
    if (data === undefined) {
      return undefined;
    }
    return {
      tree: [data.id, data.hash265],
      timestamp: new Date(data.timestamp),
      parents: JSON.parse(data.parents),
    };
  }

  async writeSnapshot(tree: DBHash, timestamp: Date, parents: Hash[]) {
    await this.db.insertInto("snapshot").values({
      tree_content_id: tree[0],
      timestamp: timestamp.toISOString(),
      parents: JSON.stringify(parents.map((it) => it.toString("hex"))),
    });
  }
}
