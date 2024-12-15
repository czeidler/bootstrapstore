import { Dialect } from "kysely";

export interface SerializableDBInstance {
  dialect: Dialect;
  serialize: () => Promise<Buffer>;
}

export interface SerializableDB {
  create: (buffer: Buffer | undefined) => Promise<SerializableDBInstance>;
}
