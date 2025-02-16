/**
 * This file was generated by kysely-codegen.
 * Please do not edit it manually.
 */

import type { ColumnType } from "kysely";

export type Generated<T> = T extends ColumnType<infer S, infer I, infer U>
  ? ColumnType<S, I | undefined, U>
  : ColumnType<T, T | undefined, T>;

export interface Blob {
  content_id: number;
  enc_key: Buffer | null;
  id: Generated<number>;
}

export interface BlobPart {
  blob_id: number;
  data: Buffer | null;
  id: Generated<number>;
  index: number;
  key: Buffer | null;
}

export interface Branch {
  commit_id: number;
  id: Generated<number>;
  name: string;
}

export interface Commit {
  hash256: Buffer;
  id: Generated<number>;
  parents: string;
  timestamp: number;
  tree_content_id: number;
}

export interface Content {
  hash265: Buffer;
  id: Generated<number>;
}

export interface TreeEntry {
  content_id: number | null;
  creation_time: number | null;
  id: Generated<number>;
  link: string | null;
  modification_time: number | null;
  name: string;
  size: number | null;
  tree_id: number;
  type: string;
}

export interface DB {
  blob: Blob;
  blob_part: BlobPart;
  branch: Branch;
  commit: Commit;
  content: Content;
  tree_entry: TreeEntry;
}
