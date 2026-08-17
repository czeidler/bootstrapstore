import path from "node:path";
import { findOrDownloadRclone } from "../node_modules/lib-node/src/rclone";
import { buildApp } from "./controller";
import { repoDir } from "./service";
import { connectToDB, migrateToLatest } from "./user/db";
import { DB } from "./user/db.generated";

const port = 8080;

// TODO make this a cli parameter
const desktopMode = true;

const main = async () => {
  const db = await connectToDB<DB>(path.join(repoDir, "database.sqlite"));
  await migrateToLatest(db);

  console.log("> Search for rclone");
  await findOrDownloadRclone();

  const app = buildApp({ desktopMode, path: repoDir, connection: db });
  app.listen(port, () => {
    console.log(`App listening on port ${port}`);
  });
};

main().catch((e) => console.error(e));
