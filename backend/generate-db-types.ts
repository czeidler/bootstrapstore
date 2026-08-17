import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { migrateToLatest } from "./src/user/db";
import { exec } from "child_process";
import fs from "fs";

async function main() {
  const tempDBPath = "temp.sqlite";

  const db = new Kysely<unknown>({
    dialect: new SqliteDialect({
      database: async () => new Database(tempDBPath),
    }),
  });
  const outpath = "./src/user";
  await migrateToLatest(db);
  await new Promise((res, err) => {
    exec(
      `node ./node_modules/kysely-codegen/dist/cli/bin.js --out-file ${outpath}/db.generated.ts`,
      {
        env: {
          DATABASE_URL: tempDBPath,
        },
      },
      (e, stdout, stderr) => {
        if (e) {
          console.error(e);
          console.error(stderr);
          err(e);
          return;
        }
        console.log(stdout);
        res(true);
      },
    );
  });

  fs.rmSync(tempDBPath);
}

main().catch((e: unknown) => {
  console.error(e);
});
