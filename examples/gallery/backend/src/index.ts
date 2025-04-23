import { findOrDownloadRclone } from "../node_modules/lib-node/src/rclone";
import { buildApp } from "./controller";

const port = 8080;

// TODO make this a cli parameter
const isAdmin = true;
const isLocal = true;

const main = async () => {
  console.log("> Search for rclone");
  await findOrDownloadRclone();

  const app = buildApp({ isAdmin, isLocal });
  app.listen(port, () => {
    console.log(`App listening on port ${port}`);
  });
};

main().catch((e) => console.error(e));
