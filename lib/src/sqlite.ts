import Database from "better-sqlite3";
import { Dialect, SqliteDialect } from "kysely";

export interface SerializableDBInstance {
  dialect: Dialect;
  serialize: () => Buffer;
}

export interface SerializableDB {
  create: (buffer: Buffer | undefined) => SerializableDBInstance;
}

export const BetterSqliteSerializableDB: SerializableDB = {
  create: (buffer: Buffer | undefined) => {
    const db = new Database(buffer);
    return {
      dialect: new SqliteDialect({
        database: db,
      }),
      serialize: () => db.serialize(),
    };
  },
};
