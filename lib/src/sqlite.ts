import { Dialect } from "kysely";

export interface SerializableDBInstance {
  dialect: Dialect;
  serialize: () => Promise<Uint8Array>;
}

export interface SerializableDB {
  create: (buffer: Uint8Array | undefined) => Promise<SerializableDBInstance>;
}
