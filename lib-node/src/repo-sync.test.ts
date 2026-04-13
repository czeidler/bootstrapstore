import { arrayToHex, RepoBlobStoreGetter, RepoConfig, Repository } from "lib";
import { describe, test, assert, afterAll } from "vitest";
import { getRepoIOConfig } from "./io-config";
import { FileBlobStore } from "./file-blob-store";
import { arrayToString } from "lib/src/utils";
import { rmSync } from "node:fs";
import path from "node:path";

const insertFiles = async (
  repo: Repository,
  files: Record<string, string | undefined>,
  now: number,
) => {
  for (const [path, data] of Object.entries(files)) {
    if (data === undefined) {
      await repo.deleteEntry(path.split("/"));
    } else {
      await repo.insertFile(path.split("/"), Buffer.from(data), now, now);
    }
  }
};

const validateFiles = async (
  repo: Repository,
  files: Record<string, string | undefined>,
) => {
  for (const [path, data] of Object.entries(files)) {
    const file = await repo.readFile(path.split("/"));
    if (data === undefined) {
      assert.isUndefined(file);
      continue;
    }
    assert.isDefined(file);
    assert.equal(arrayToString(file), data);
  }
};

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

    test("should be able to pull and merge", async () => {
      const ours = await createRepo("pullMergeOurs");
      const theirs = await createRepo("pullMergeTheirs");

      // check it doesn't fail to pull an empty repo
      await ours.pull(theirs, new Date(5000));

      const files = {
        "dir1/dir2/file1": "toBeUpdatedInOurs",
        "dir1/dir2/file2": "toBeUpdatedInTheirs",
        "dir1/dir2/file3": "toBeUpdatedInBoth",
        "dir1/dir2/file4": "toBeDeletedInOurs",
        "dir1/dir2/file5": "toBeDeletedInTheirs",
        "dir1/dir2/file6": "nottouched",
        "dir1/file7": "filedata4",
      } as const;
      await insertFiles(theirs, files, 10000);
      await theirs.createSnapshot(new Date(11000));

      await ours.pull(theirs, new Date(15000));

      assert.equal((await ours.listCommits()).length, 1);

      await validateFiles(ours, files);

      // 3 way merge
      const ourChange = {
        "dir1/dir2/file1": "updatedInOurs",
        "dir1/dir2/file3": "updatedInBothOurs",
        "dir1/dir2/file4": undefined,
        "dir1/dir2/file8": "addedInBoth",
      } as const;
      await insertFiles(ours, ourChange, 20000);
      await ours.createSnapshot(new Date(21000));

      const theirChange = {
        "dir1/dir2/file2": "updatedInTheirs",
        "dir1/dir2/file3": "updatedInBothTheirs",
        "dir1/dir2/file5": undefined,
        "dir1/dir2/file8": "addedInBoth",
      } as const;
      await insertFiles(theirs, theirChange, 30000);
      await theirs.createSnapshot(new Date(31000));

      await ours.pull(theirs, new Date(35000));
      assert.equal((await ours.listCommits()).length, 4);
      await validateFiles(ours, {
        ...files,
        "dir1/dir2/file1": "updatedInOurs",
        "dir1/dir2/file2": "updatedInTheirs",
        "dir1/dir2/file3": "updatedInBothTheirs",
        "dir1/dir2/file4": undefined,
        "dir1/dir2/file5": undefined,
        "dir1/dir2/file8": "addedInBoth",
      });
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
