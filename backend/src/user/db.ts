import { Kysely, SqliteDialect } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { promises as fs } from "fs";
import path from "path";
import Database from "better-sqlite3";
import { DB } from "./db.generated";

export type Connection = Kysely<DB>;

export async function connectToDB<T>(path: string): Promise<Kysely<T>> {
  const db = new Kysely<T>({
    dialect: new SqliteDialect({ database: new Database(path) }),
  });
  return db;
}

/** Executes the job in a transaction. If the con is already in a transaction just execute the job in the current tx. */
export function tx<T, R>(con: Kysely<T>, job: (con: Kysely<T>) => Promise<R>) {
  if (con.isTransaction) {
    return job(con);
  }
  return con.transaction().execute(job);
}

export async function migrateToLatest<T>(db: Kysely<T>) {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // This needs to be an absolute path.
      migrationFolder: path.join(__dirname, "migrations"),
    }),
  });

  // Run migrations before starting up the server
  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("failed to migrate");
    console.error(error);
    process.exit(1);
  }
}
