import { program } from "commander";
import { MetadataRepository } from "lib";
import { FileBlobStore, getRepoIOConfig } from "lib-node";
import { RepoBlobStoreGetter, arrayToHex, Repository } from "lib";
import { snapshotDirWithThumbnails } from "./snapshot";

async function initRepo(keyHex: string) {
  const key = Buffer.from(keyHex, "hex");
  const repoId = arrayToHex(crypto.getRandomValues(new Uint8Array(12)));
  const storeGetter = new RepoBlobStoreGetter(
    new FileBlobStore([".storage", "repos"])
  );
  await Repository.create(repoId, getRepoIOConfig(), storeGetter, key);
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
        getRepoIOConfig(),
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
        getRepoIOConfig(),
        storeGetter,
        {
          key: Buffer.from(arg.keyHex, "hex"),
          branch: "main",
          inlined: false,
        }
      );
      const mainRepo = await MetadataRepository.fromRepo(
        repo,
        storeGetter,
        getRepoIOConfig()
      );
      // TODO handle default profileId:
      const child = await mainRepo.createChild("default");
      console.log(`Child repo id: ${child.repoId}`);
      await repo.insertRepoLink(arg.childTargetPath.split("/"), child.repoId);
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
        getRepoIOConfig(),
        storeGetter,
        {
          key,
          branch: "main",
          inlined: false,
        }
      );
      // TODO handle default profileId:
      const child1 = await (
        await MetadataRepository.fromRepo(repo, storeGetter, getRepoIOConfig())
      ).openChild("default", arg.childRepoId);
      if (child1 === undefined) {
        console.error(`Can't find child repo`);
        return;
      }
      await snapshotDirWithThumbnails(child1, arg.sourceDir);
    }
  );
program.parse(process.argv);
