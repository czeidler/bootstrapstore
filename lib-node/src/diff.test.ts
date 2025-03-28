import { describe, test, assert } from "vitest";

import { DirEntry } from "lib/src/repository";
import { DiffEntry, diffWalk, DirReader } from "./diff";

// [mTime]
type FileEntry = [number];

interface ObjectDirEntry {
  [key: string]: FileEntry | ObjectDirEntry | undefined;
}

class ObjectDirReader implements DirReader {
  constructor(private content: ObjectDirEntry) {}

  async list(path: string[]): Promise<DirEntry[]> {
    let current: ObjectDirEntry | FileEntry | undefined = this.content;
    for (const p of path) {
      if (Array.isArray(current)) {
        return [];
      }
      current = current[p];
      if (current === undefined) {
        return [];
      }
    }
    if (Array.isArray(current)) {
      return [];
    }
    return Object.entries(current)
      .map(([name, entry]) => {
        if (entry === undefined) {
          return undefined;
        }
        if (Array.isArray(entry)) {
          return {
            type: "file",
            name,
            modificationTime: entry[0],
            creationTime: entry[0],
            size: 1,
          } satisfies DirEntry;
        }
        return { type: "dir", name } satisfies DirEntry;
      })
      .filter((it) => it !== undefined);
  }
}

type ExpectedEntry =
  | {
      /** Relative to the "ours" dir, e.g. entry was Added in "ours"  */
      type: "Added";
      our: [number];
    }
  | {
      /** Relative to the "ours" dir, e.g. entry was Deleted in "ours"  */
      type: "Deleted";
      their: [number];
    }
  | {
      type: "Changed";
      our: [number];
      their: [number];
    };

const assertDiffEntries = (
  results: Map<string, DiffEntry>,
  expected: Record<string, ExpectedEntry | undefined>
) => {
  const actual = Array.from(results.entries()).reduce<
    Record<string, ExpectedEntry | undefined>
  >((prev, [path, entry]) => {
    switch (entry.type) {
      case "Added":
        if (entry.our.type !== "file") {
          assert.fail(`File expected but got ${JSON.stringify(entry.our)}`);
        }
        prev[path] = { type: entry.type, our: [entry.our.modificationTime] };
        break;
      case "Deleted":
        if (entry.their.type !== "file") {
          assert.fail(`File expected but got ${JSON.stringify(entry.their)}`);
        }
        prev[path] = {
          type: entry.type,
          their: [entry.their.modificationTime],
        };
        break;
      case "Changed":
        if (entry.their.type !== "file" || entry.our.type !== "file") {
          assert.fail(
            `File expected but got ${JSON.stringify(
              entry.our
            )},  ${JSON.stringify(entry.their)}`
          );
        }
        prev[path] = {
          type: entry.type,
          their: [entry.their.modificationTime],
          our: [entry.our.modificationTime],
        };
        break;
    }
    return prev;
  }, {});
  assert.deepEqual(actual, expected);
};

describe("Diff test", () => {
  test("should be able diff flat dir", async () => {
    const results: Map<string, DiffEntry> = new Map();
    await diffWalk(
      new ObjectDirReader({
        file1: [1],
        file2: [1],
        file3: [1],
      }),
      new ObjectDirReader({
        file1: [1],
        file2: [2],
        file4: [2],
      }),
      (entry) => {
        results.set(entry.path.join("/"), entry);
      }
    );
    assertDiffEntries(results, {
      file2: { type: "Changed", our: [1], their: [2] },
      file3: { type: "Added", our: [1] },
      file4: { type: "Deleted", their: [2] },
    });
  });

  test("should be able diff empty our dir", async () => {
    const results: Map<string, DiffEntry> = new Map();
    await diffWalk(
      new ObjectDirReader({}),
      new ObjectDirReader({
        file1: [2],
        file2: [2],
        file3: [2],
      }),
      (entry) => {
        results.set(entry.path.join("/"), entry);
      }
    );
    assertDiffEntries(results, {
      file1: { type: "Deleted", their: [2] },
      file2: { type: "Deleted", their: [2] },
      file3: { type: "Deleted", their: [2] },
    });
  });

  test("should be able diff empty their dir", async () => {
    const results: Map<string, DiffEntry> = new Map();
    await diffWalk(
      new ObjectDirReader({ file1: [1], file2: [1], file3: [1] }),
      new ObjectDirReader({}),
      (entry) => {
        results.set(entry.path.join("/"), entry);
      }
    );
    assertDiffEntries(results, {
      file1: { type: "Added", our: [1] },
      file2: { type: "Added", our: [1] },
      file3: { type: "Added", our: [1] },
    });
  });

  test("should be able diff nested dir", async () => {
    const results: Map<string, DiffEntry> = new Map();
    await diffWalk(
      new ObjectDirReader({
        subDir0: { file1: [1] },
        subDir1: {
          subDir2: { file2: [1] },
        },
        subDir2: { file3: [1] },
      }),
      new ObjectDirReader({
        subDir0: { file1: [1] },
        subDir1: { subDir2: { file2: [2] } },
        subDir2: { file4: [2] },
      }),
      (entry) => {
        results.set(entry.path.join("/"), entry);
      }
    );
    assertDiffEntries(results, {
      "subDir1/subDir2/file2": { type: "Changed", our: [1], their: [2] },
      "subDir2/file3": { type: "Added", our: [1] },
      "subDir2/file4": { type: "Deleted", their: [2] },
    });
  });
});
