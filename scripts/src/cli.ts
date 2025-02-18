import { program } from "commander";
import { MainRepository, Repository } from "lib";
import { BetterSqliteSerializableDB, FileBlobStore } from "lib-node";
import { RepoBlobStoreGetter } from "lib/src/blob-store";
import { arrayToHex } from "lib/src/utils";
import { snapshotDirWithThumbnails } from "./snapshot";

async function initRepo(keyHex: string) {
  const key = Buffer.from(keyHex, "hex");
  const repoId = arrayToHex(crypto.getRandomValues(new Uint8Array(12)));
  const storeGetter = new RepoBlobStoreGetter(
    new FileBlobStore([".storage", "repos"])
  );
  await Repository.create(repoId, BetterSqliteSerializableDB, storeGetter, {
    key,
    branch: "main",
    inlined: false,
  });
  console.log(`Repo created: ${repoId}`);
}

program.command("keygen").action(() => {
  const key = arrayToHex(crypto.getRandomValues(new Uint8Array(16)));
  console.log(key);
});
const repo = program.command("repo");
repo
  .command("init")
  .requiredOption("--keyHex <type>")
  .action(async (arg: { keyHex: string }) => {
    await initRepo(arg.keyHex);
  });
repo
  .command("snapshot")
  .requiredOption("--keyHex <type>")
  .requiredOption("--repoId <type>")
  .requiredOption("--sourceDir <type>")
  .action(
    async (arg: { keyHex: string; repoId: string; sourceDir: string }) => {
      const key = Buffer.from(arg.keyHex, "hex");
      const storeGetter = new RepoBlobStoreGetter(
        new FileBlobStore([".storage", "repos"])
      );
      const repo = await Repository.open(
        arg.repoId,
        BetterSqliteSerializableDB,
        storeGetter,
        {
          key,
          branch: "main",
          inlined: false,
        }
      );
      await snapshotDirWithThumbnails(repo, arg.sourceDir);
    }
  );
repo
  .command("add")
  .description("Add a new child repository and links to a target file")
  .requiredOption("--keyHex <type>")
  .requiredOption("--repoId <type>")
  .requiredOption("--childTargetPath <type>")
  .action(
    async (arg: {
      keyHex: string;
      repoId: string;
      childTargetPath: string;
    }) => {
      const storeGetter = new RepoBlobStoreGetter(
        new FileBlobStore([".storage", "repos"])
      );
      const repo = await Repository.open(
        arg.repoId,
        BetterSqliteSerializableDB,
        storeGetter,
        {
          key: Buffer.from(arg.keyHex, "hex"),
          branch: "main",
          inlined: false,
        }
      );
      const mainRepo = new MainRepository(repo);
      const child = await mainRepo.createChild(
        BetterSqliteSerializableDB,
        storeGetter
      );
      console.log(`Child repo id: ${child.repoId}`);
      await repo.insertRepoLink(arg.childTargetPath.split("/"), child.repoId);
      await repo.insertFile(["test"], Buffer.from("test"), 0, 0);
      await repo.createSnapshot(new Date());
    }
  );

repo
  .command("snapshotChild")
  .requiredOption("--keyHex <type>")
  .requiredOption("--repoId <type>")
  .requiredOption("--childRepoId <type>")
  .requiredOption("--sourceDir <type>")
  .action(
    async (arg: {
      keyHex: string;
      repoId: string;
      childRepoId: string;
      sourceDir: string;
    }) => {
      const key = Buffer.from(arg.keyHex, "hex");
      const storeGetter = new RepoBlobStoreGetter(
        new FileBlobStore([".storage", "repos"])
      );
      const repo = await Repository.open(
        arg.repoId,
        BetterSqliteSerializableDB,
        storeGetter,
        {
          key,
          branch: "main",
          inlined: false,
        }
      );
      const child1 = await new MainRepository(repo).openChild(
        arg.childRepoId,
        BetterSqliteSerializableDB,
        storeGetter
      );
      if (child1 === undefined) {
        console.error(`Can't find child repo`);
        return;
      }
      await snapshotDirWithThumbnails(child1, arg.sourceDir);
    }
  );
program.parse(process.argv);
