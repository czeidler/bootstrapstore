import { describe, test, assert, afterAll } from "vitest";
import { MainRepository, Repository } from "lib";
import { FileBlobStore } from "./file-blob-store";
import { BetterSqliteSerializableDB } from "./better-sqlite";
import * as fs from "node:fs";
import path from "node:path";
import { arrayToHex } from "lib/src/utils";

describe("Main repo test", () => {
  const testDir = ["./test-main-repo"];
  test("should be able to add and open child repository", async () => {
    const store = new FileBlobStore(["."]);
    const repoId = arrayToHex(crypto.getRandomValues(new Uint8Array(12)));
    const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
    const rootRepo = await Repository.create(
      repoId,
      BetterSqliteSerializableDB,
      store,
      testDir,
      {
        key,
        branch: "main",
        inlined: false,
      }
    );

    const mainRepo = new MainRepository(rootRepo);
    const child = await mainRepo.createChild(BetterSqliteSerializableDB, store);
    await child.insertFile(["child1"], Buffer.from("child"));
    await child.createSnapshot(new Date());

    const child1 = await mainRepo.openChild(
      child.repoId,
      BetterSqliteSerializableDB,
      store
    );
    assert.equal((await child1?.readFile(["child1"]))?.toString(), "child");
  });

  afterAll(() => {
    fs.rmSync(path.join(...testDir), { recursive: true, force: true });
  });
});
