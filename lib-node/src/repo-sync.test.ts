import { arrayToHex, RepoBlobStoreGetter, RepoConfig, Repository } from "lib";
import { describe, test, assert, afterAll } from "vitest";
import { getRepoIOConfig } from "./io-config";
import { FileBlobStore } from "./file-blob-store";
import { arrayToString } from "lib/src/utils";
import { rmSync } from "node:fs";
import path from "node:path";

const buildTest = (name: string, config: RepoConfig) => {
  describe(name, () => {
    const testDir = ["./testRepoSync"];
    afterAll(() => {
      rmSync(path.join(...testDir), { recursive: true, force: true });
    });

    const createRepo = async (path: string) => {
      const testDirOurs = [...testDir, path];
      const storeGetter = new RepoBlobStoreGetter(
        new FileBlobStore(testDirOurs),
      );
      const repoId = arrayToHex(crypto.getRandomValues(new Uint8Array(12)));
      await Repository.create(
        repoId,
        getRepoIOConfig(),
        storeGetter,
        config.key,
      );
      const repo = await Repository.open(
        repoId,
        getRepoIOConfig(),
        storeGetter,
        config,
      );
      return repo;
    };

    test("should copy blobs", async () => {
      const ours = await createRepo("simplePullOurs");
      const theirs = await createRepo("simplePullTheirs");

      await ours.pull(theirs);

      const now = Date.now();
      await theirs.insertFile(
        ["dir1", "dir2", "file1"],
        Buffer.from("filedata1"),
        now,
        now,
      );
      await theirs.insertFile(
        ["dir1", "file2"],
        Buffer.from("filedata2"),
        now,
        now,
      );
      await theirs.createSnapshot(new Date());

      await ours.pull(theirs);

      assert.equal((await ours.listCommits()).length, 1);

      const file1 = await ours.readFile(["dir1", "dir2", "file1"]);
      assert.isDefined(file1);
      assert.equal(arrayToString(file1), "filedata1");
      const file2 = await ours.readFile(["dir1", "file2"]);
      assert.isDefined(file2);
      assert.equal(arrayToString(file2), "filedata2");
    });
  });
};

const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
buildTest("Repo sync test (inlined: false))", {
  key,
  branch: "main",
  inlined: false,
});

buildTest("Repo sync test (inlined: true))", {
  key,
  branch: "main-inlined",
  inlined: true,
});
