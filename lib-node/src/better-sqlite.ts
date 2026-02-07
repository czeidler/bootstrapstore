import Database from "better-sqlite3";
import { SqliteDialect } from "kysely";
import { SerializableDB } from "lib";

const arrayToBuffer = (array: Uint8Array) => {
  const buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  return buffer;
};

export const BetterSqliteSerializableDB: SerializableDB = {
  create: async (buffer: Uint8Array | undefined) => {
    const db = new Database(buffer ? arrayToBuffer(buffer) : undefined);
    return {
      dialect: new SqliteDialect({
        database: db,
      }),
      serialize: async () => db.serialize(),
    };
  },
};
