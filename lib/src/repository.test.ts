import { describe, test, assert, afterAll } from "vitest";
import { Repository } from "./repository";
import { FileBlobStore } from "./file-blob-store";
import { BetterSqliteSerializableDB } from "./sqlite";
import * as fs from "node:fs";
import path from "node:path";

describe("Repository tests", () => {
  const testDir = ["./test"];
  test("should do basic IO", async () => {
    const store = new FileBlobStore(["."]);
    const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
    const repo = await Repository.create(
      BetterSqliteSerializableDB,
      store,
      testDir,
      key
    );
    await repo.insertFile(["file1"], Buffer.from("filedata1"));
    await repo.createSnapshot(new Date());

    const list = await repo.listDirectory([]);
    assert.equal(list?.length, 1);

    const repo2 = await Repository.open(
      repo.repoId,
      BetterSqliteSerializableDB,
      store,
      testDir,
      key
    );
    const list2 = await repo2.listDirectory([]);
    assert.equal(list2?.length, 1);
    const content = await repo2.readFile(["file1"]);
    assert.equal(content?.toString(), "filedata1");
  });

  test("should do handle sub directories", async () => {
    const store = new FileBlobStore(["."]);
    const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
    const repo = await Repository.create(
      BetterSqliteSerializableDB,
      store,
      testDir,
      key
    );
    await repo.insertFile(["subdir", "file1"], Buffer.from("filedata1"));
    await repo.insertFile(["subdir", "file2"], Buffer.from("filedata2"));
    await repo.createSnapshot(new Date());

    const list = await repo.listDirectory([]);
    assert.equal(list?.length, 1);
    const subDirList = await repo.listDirectory(["subdir"]);
    assert.equal(subDirList?.length, 2);

    const repo2 = await Repository.open(
      repo.repoId,
      BetterSqliteSerializableDB,
      store,
      testDir,
      key
    );
    const list2 = await repo2.listDirectory([]);
    assert.equal(list2?.length, 1);
    const content = await repo2.readFile(["subdir", "file1"]);
    assert.equal(content?.toString(), "filedata1");
  });

  afterAll(() => {
    fs.rmSync(path.join(...testDir), { recursive: true, force: true });
  });
});
