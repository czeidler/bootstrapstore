import { describe, test, assert, afterAll } from "vitest";
import { Repository } from "lib";
import { FileBlobStore } from "./file-blob-store";
import { BetterSqliteSerializableDB } from "./better-sqlite";
import * as fs from "node:fs";
import path from "node:path";
import { RepoConfig } from "lib/src/repository";
import { arrayToHex } from "lib/src/utils";
import { RepoBlobStoreGetter } from "lib/src/blob-store";

const buildTest = (name: string, config: RepoConfig) => {
  describe(name, () => {
    const testDir = ["./test"];
    test("should do basic IO", async () => {
      const storeGetter = new RepoBlobStoreGetter(new FileBlobStore(testDir));
      const repoId = arrayToHex(crypto.getRandomValues(new Uint8Array(12)));
      const repo = await Repository.create(
        repoId,
        BetterSqliteSerializableDB,
        storeGetter,
        config
      );
      const now = Date.now();
      await repo.insertFile(["file1"], Buffer.from("filedata1"), now, now);
      await repo.createSnapshot(new Date());

      const list = await repo.listDirectory([]);
      assert.equal(list?.length, 1);

      const repo2 = await Repository.open(
        repo.repoId,
        BetterSqliteSerializableDB,
        storeGetter,
        config
      );
      const list2 = await repo2.listDirectory([]);
      assert.equal(list2?.length, 1);
      const content = await repo2.readFile(["file1"]);
      assert.equal(content?.toString(), "filedata1");
    });

    test("should do handle sub directories", async () => {
      const storeGetter = new RepoBlobStoreGetter(new FileBlobStore(testDir));
      const repoId = arrayToHex(crypto.getRandomValues(new Uint8Array(12)));
      const repo = await Repository.create(
        repoId,
        BetterSqliteSerializableDB,
        storeGetter,
        config
      );
      const now = Date.now();
      await repo.insertFile(
        ["subdir", "file1"],
        Buffer.from("filedata1"),
        now,
        now
      );
      await repo.insertFile(
        ["subdir", "file2"],
        Buffer.from("filedata2"),
        now,
        now
      );
      await repo.createSnapshot(new Date());

      const list = await repo.listDirectory([]);
      assert.equal(list?.length, 1);
      const subDirList = await repo.listDirectory(["subdir"]);
      assert.equal(subDirList?.length, 2);

      const repo2 = await Repository.open(
        repo.repoId,
        BetterSqliteSerializableDB,
        storeGetter,
        config
      );
      const list2 = await repo2.listDirectory([]);
      assert.equal(list2?.length, 1);
      const content = await repo2.readFile(["subdir", "file1"]);
      assert.equal(content?.toString(), "filedata1");
    });

    test("should be able to create multiple snapshots", async () => {
      const storeGetter = new RepoBlobStoreGetter(new FileBlobStore(testDir));
      const repoId = arrayToHex(crypto.getRandomValues(new Uint8Array(12)));
      const repo = await Repository.create(
        repoId,
        BetterSqliteSerializableDB,
        storeGetter,
        config
      );
      const now = Date.now();
      const path = ["subdir", "file1"];
      await repo.insertFile(path, Buffer.from("filedata1"), now, now);
      await repo.createSnapshot(new Date());
      assert.equal((await repo.readFile(path))?.toString(), "filedata1");

      await repo.insertFile(path, Buffer.from("filedata2"), now, now);
      await repo.createSnapshot(new Date());
      assert.equal((await repo.readFile(path))?.toString(), "filedata2");

      const repo2 = await Repository.open(
        repo.repoId,
        BetterSqliteSerializableDB,
        storeGetter,
        config
      );
      assert.equal((await repo2.readFile(path))?.toString(), "filedata2");
    });

    test("should be able to store repo links", async () => {
      const storeGetter = new RepoBlobStoreGetter(new FileBlobStore(testDir));
      const repoId = arrayToHex(crypto.getRandomValues(new Uint8Array(12)));
      const repo = await Repository.create(
        repoId,
        BetterSqliteSerializableDB,
        storeGetter,
        config
      );
      const path = ["link1"];
      await repo.insertRepoLink(path, "repoId");
      await repo.createSnapshot(new Date());
      assert.equal(await repo.readRepoLink(path), "repoId");

      const repo2 = await Repository.open(
        repo.repoId,
        BetterSqliteSerializableDB,
        storeGetter,
        config
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
