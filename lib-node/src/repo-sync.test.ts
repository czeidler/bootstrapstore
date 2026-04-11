import { arrayToHex, RepoBlobStoreGetter, RepoConfig, Repository } from "lib";
import { describe, test, assert } from "vitest";
import { getRepoIOConfig } from "./io-config";
import { FileBlobStore } from "./file-blob-store";
import { arrayToString } from "lib/src/utils";

const buildTest = (name: string, config: RepoConfig) => {
  describe("Repo sync test", () => {
    test("should copy blobs", async () => {
      const testDirOurs = ["./testOurs"];
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
      const ours = await Repository.open(
        repoId,
        getRepoIOConfig(),
        storeGetter,
        config,
      );

      const testDirTheirs = ["./testTheirs"];
      const storeGetterTheirs = new RepoBlobStoreGetter(
        new FileBlobStore(testDirTheirs),
      );
      const repoIdTheirs = arrayToHex(
        crypto.getRandomValues(new Uint8Array(12)),
      );
      await Repository.create(
        repoIdTheirs,
        getRepoIOConfig(),
        storeGetterTheirs,
        config.key,
      );
      const theirs = await Repository.open(
        repoIdTheirs,
        getRepoIOConfig(),
        storeGetterTheirs,
        config,
      );

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
