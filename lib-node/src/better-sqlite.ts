import Database from "better-sqlite3";
import { SqliteDialect } from "kysely";
import { SerializableDB } from "lib";

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
