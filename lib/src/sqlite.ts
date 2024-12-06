import Database from "better-sqlite3";
import { Dialect, SqliteDialect } from "kysely";

export interface SerializableDBInstance {
  dialect: Dialect;
  serialize: () => Promise<Buffer>;
}

export interface SerializableDB {
  create: (buffer: Buffer | undefined) => Promise<SerializableDBInstance>;
}

export const BetterSqliteSerializableDB: SerializableDB = {
  create: async (buffer: Buffer | undefined) => {
    const db = new Database(buffer);
    return {
      dialect: new SqliteDialect({
        database: db,
      }),
      serialize: async () => db.serialize(),
    };
  },
};
