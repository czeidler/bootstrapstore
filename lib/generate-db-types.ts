import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { migrateToLatest } from "./src/migration";
import { exec } from "child_process";
import fs from "fs";

async function main() {
  const tempDBPath = "temp.sqlite";
  const db = new Kysely<unknown>({
    dialect: new SqliteDialect({
      database: async () => new Database(tempDBPath),
    }),
  });
  const outpath = "./src/db";
  fs.rmSync(outpath, { recursive: true, force: true });
  await migrateToLatest(db);
  await new Promise((res, err) => {
    exec(
      `kysely-codegen --out-file ${outpath}/db.d.ts`,
      (e, stdout, stderr) => {
        if (e) {
          console.error(e);
          console.error(stderr);
          return err(e);
        }
        console.log(stdout);
        res(true);
      }
    );
  });

  fs.rmSync(tempDBPath);
}

main().catch((e) => console.error(e));
