import { describe, test, assert, afterAll } from "vitest";
import { Repository, RepoBlobStoreGetter } from "lib";
import { FileBlobStore } from "./file-blob-store";
import * as fs from "node:fs";
import path from "node:path";
import { RepoConfig, arrayToHex } from "lib";
import { getRepoIOConfig } from "./io-config";
import { arrayToString } from "lib/src/utils";

const buildTest = (name: string, config: RepoConfig) => {
  describe(name, () => {
    const testDir = ["./test"];
    test("should do basic IO", async () => {
      const storeGetter = new RepoBlobStoreGetter(new FileBlobStore(testDir));
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

      // should be able to do invalid read and then write trees (previous bug)
      await repo.readFile(["invalid", "file"]);

      const now = Date.now();
      await repo.insertFile(["file1"], Buffer.from("filedata1"), now, now);
      await repo.createSnapshot(new Date());

      const list = await repo.listDirectory([]);
      assert.equal(list.length, 1);

      const repo2 = await Repository.open(
        repo.repoId,
        getRepoIOConfig(),
        storeGetter,
        config,
      );
      const list2 = await repo2.listDirectory([]);
      assert.equal(list2.length, 1);
      const content = await repo2.readFile(["file1"]);
      assert.isDefined(content);
      assert.equal(arrayToString(content), "filedata1");

      // should be able to create empty directory
      await repo2.insertDirs(["emptyDir"]);
      assert.isDefined(
        (await repo2.listDirectory([])).find(
          (it) => it.name === "emptyDir" && it.type === "dir",
        ),
      );
      assert.equal((await repo2.listDirectory(["emptyDir"])).length, 0);
      await repo2.insertDirs(["emptyDir2", "subDir"]);
      assert.isDefined(
        (await repo2.listDirectory(["emptyDir2"])).find(
          (it) => it.name === "subDir" && it.type === "dir",
        ),
      );
      assert.equal(
        (await repo2.listDirectory(["emptyDir2", "subDir"])).length,
        0,
      );
      // should be able to delete directory
      await repo2.deleteEntry(["emptyDir2", "subDir"]);
      assert.equal((await repo2.listDirectory(["emptyDir2"])).length, 0);
      assert.isDefined(
        (await repo2.listDirectory([])).find(
          (it) => it.name === "emptyDir2" && it.type === "dir",
        ),
      );
      assert.equal((await repo2.listDirectory(["emptyDir2"])).length, 0);
      // should be able to delete directory from root
      await repo2.deleteEntry(["emptyDir2"]);
      assert.isUndefined(
        (await repo2.listDirectory([])).find(
          (it) => it.name === "emptyDir2" && it.type === "dir",
        ),
      );
    });

    test("should do handle sub directories", async () => {
      const storeGetter = new RepoBlobStoreGetter(new FileBlobStore(testDir));
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
      const now = Date.now();
      await repo.insertFile(
        ["subdir", "file1"],
        Buffer.from("filedata1"),
        now,
        now,
      );
      await repo.insertFile(
        ["subdir", "file2"],
        Buffer.from("filedata2"),
        now,
        now,
      );
      await repo.createSnapshot(new Date());

      const list = await repo.listDirectory([]);
      assert.equal(list.length, 1);
      const subDirList = await repo.listDirectory(["subdir"]);
      assert.equal(subDirList.length, 2);

      const repo2 = await Repository.open(
        repo.repoId,
        getRepoIOConfig(),
        storeGetter,
        config,
      );
      const list2 = await repo2.listDirectory([]);
      assert.equal(list2.length, 1);
      const content = await repo2.readFile(["subdir", "file1"]);
      assert.isDefined(content);
      assert.equal(arrayToString(content), "filedata1");
    });

    test("should be able to create multiple snapshots", async () => {
      const storeGetter = new RepoBlobStoreGetter(new FileBlobStore(testDir));
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
      const now = Date.now();
      const path = ["subdir", "file1"];
      await repo.insertFile(path, Buffer.from("filedata1"), now, now);
      await repo.createSnapshot(new Date());
      const file = await repo.readFile(path);
      assert.isDefined(file);
      assert.equal(arrayToString(file), "filedata1");

      await repo.insertFile(path, Buffer.from("filedata2"), now, now);
      await repo.createSnapshot(new Date());
      const file2 = await repo.readFile(path);
      assert.isDefined(file2);
      assert.equal(arrayToString(file2), "filedata2");

      const repo2 = await Repository.open(
        repo.repoId,
        getRepoIOConfig(),
        storeGetter,
        config,
      );
      const file3 = await repo2.readFile(path);
      assert.isDefined(file3);
      assert.equal(arrayToString(file3), "filedata2");
    });

    test("should be able to store repo links", async () => {
      const storeGetter = new RepoBlobStoreGetter(new FileBlobStore(testDir));
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
      const path = ["link1"];
      await repo.insertRepoLink(path, "repoId");
      await repo.createSnapshot(new Date());
      assert.equal(await repo.readRepoLink(path), "repoId");

      const repo2 = await Repository.open(
        repo.repoId,
        getRepoIOConfig(),
        storeGetter,
        config,
      );
      assert.equal(await repo2.readRepoLink(path), "repoId");
    });

    afterAll(() => {
      fs.rmSync(path.join(...testDir), { recursive: true, force: true });
    });
  });
};

const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
buildTest("Repository tests (main, blob store)", {
  key,
  branch: "main",
  inlined: false,
});

buildTest("Repository tests (.config, inlined)", {
  key,
  branch: ".config",
  inlined: true,
});
