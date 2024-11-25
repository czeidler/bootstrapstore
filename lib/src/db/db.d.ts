/**
 * This file was generated by kysely-codegen.
 * Please do not edit it manually.
 */

import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export interface Content {
  hash265: Buffer;
  id: Generated<number>;
}

export interface EncBlob {
  content_id: number;
  id: Generated<number>;
  key: Buffer;
}

export interface EncBlobPart {
  enc_blob_id: number;
  hash: Buffer;
  id: Generated<number>;
  index: number;
}

export interface Snapshot {
  hash256: Buffer;
  id: Generated<number>;
  parents: string;
  timestamp: string;
  tree_content_id: number;
}

export interface TreeEntry {
  blob_id: number;
  id: Generated<number>;
  name: string;
  tree_id: number;
  type: string;
}

export interface DB {
  content: Content;
  enc_blob: EncBlob;
  enc_blob_part: EncBlobPart;
  snapshot: Snapshot;
  tree_entry: TreeEntry;
}
