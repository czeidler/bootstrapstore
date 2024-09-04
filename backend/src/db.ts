import {
  ColumnType,
  FileMigrationProvider,
  Generated,
  Insertable,
  Kysely,
  Migrator,
  Selectable,
} from "kysely";
import { promises as fs } from "fs";
import { KyselyPGlite } from "kysely-pglite";
import path from "path";

export interface UserTable {
  id: ColumnType<string, string, never>;
  email: string;
  registration_record: string;
  created_at: Generated<Date>;
}

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;

export interface FileTable {
  id: Generated<number>;
  user_id: ColumnType<string, string, never>;
  name: ColumnType<string, string, never>;
  data: string;
  created_at: Generated<Date>;
}

export type File = Selectable<FileTable>;
export type NewFile = Insertable<FileTable>;

export interface DB {
  user: UserTable;
  file: FileTable;
}

export type Connection = Kysely<DB>;

export async function connectToDB<T>(path: string): Promise<Kysely<T>> {
  const { dialect } = await KyselyPGlite.create(path);
  const db = new Kysely<T>({ dialect });
  return db;
}

/** Executes the job in a transaction. If the con is already in a transaction just execute the job in the current tx. */
export function tx<T, R>(con: Kysely<T>, job: (con: Kysely<T>) => Promise<R>) {
  if (con.isTransaction) {
    return job(con);
  }
  return con.transaction().execute(job);
}

export async function migrate<T>(db: Kysely<T>) {
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
