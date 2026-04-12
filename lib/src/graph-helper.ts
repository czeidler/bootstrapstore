import { BlobStore } from "./blob-store";
import { Hash } from "./hasher";
import { IndexRepository, Snapshot, TreeEntryType } from "./index-repository";
import { Repository } from "./repository";
import { BlobInfo, DBHash, ReadEntry, Tree, TreeBuilder } from "./tree-builder";
import { arraysEqual, arrayToHex } from "./utils";

type CommitNode = { hash256: Hash; parents: string[]; timestamp: Date };

export function getRelatedCommits<T extends CommitNode>(
  head: T,
  commits: T[],
): Map<string, T> {
  const commitsMap = commitsToMap(commits);

  const headEntry = { hash: arrayToHex(head.hash256), commit: head };
  const ongoing = [headEntry];
  const handled = new Map<string, T>();
  while (ongoing.length > 0) {
    const cur = ongoing.pop();
    if (cur === undefined) {
      throw Error("Unexpected");
    }
    handled.set(cur.hash, cur.commit);
    for (const p of cur.commit.parents) {
      if (handled.has(p)) {
        continue;
      }
      const curCommit = commitsMap.get(p);
      if (curCommit === undefined) {
        continue;
      }
      ongoing.push({ hash: p, commit: curCommit });
    }
  }
  return handled;
}

function commitsToMap<T extends CommitNode>(commits: T[]): Map<string, T> {
  return commits.reduce((prev, cur) => {
    prev.set(arrayToHex(cur.hash256), cur);
    return prev;
  }, new Map<string, T>());
}

export function findCommonAncestor<T extends CommitNode>(
  headLeft: T,
  commitsLeftAll: T[],
  headRight: T,
  commitsRightAll: T[],
): T | undefined {
  const commitsLeft = getRelatedCommits(headLeft, commitsLeftAll);
  const commitsRight = getRelatedCommits(headRight, commitsRightAll);

  const commitsRDesc = Array.from(commitsRight.entries());
  commitsRDesc.sort(
    (a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime(),
  );

  for (const commitRight of commitsRDesc) {
    if (commitsLeft.has(commitRight[0])) {
      return commitRight[1];
    }
  }
  return undefined;
}

export type ConflictSolver = (
  conflict: /** Ours and theirs was modified */
    | { our: ReadEntry; their: ReadEntry }
    /** Theirs was modified while ours was deleted */
    | { base: ReadEntry; our: ReadEntry | undefined; their: ReadEntry }
    /** Ours was modified while ours was deleted */
    | { base: ReadEntry; our: ReadEntry; their: ReadEntry | undefined },
) => ReadEntry | undefined;
export async function threeWayMerge(
  repo: IndexRepository,
  base: Snapshot,
  ours: Snapshot,
  theirs: Snapshot,
  solver: ConflictSolver,
): Promise<{ treeHash: DBHash | undefined; parents: Hash[] }> {
  const baseTree = base.tree
    ? await repo.readTree(base.tree)
    : { entries: new Map() };
  const oursTree = ours.tree
    ? await repo.readTree(ours.tree)
    : { entries: new Map() };
  const theirsTree = theirs.tree
    ? await repo.readTree(theirs.tree)
    : { entries: new Map() };

  const treeBuilder = new TreeBuilder({ entries: new Map() });
  await threeWayMergeTree(
    repo,
    baseTree,
    oursTree,
    theirsTree,
    [],
    treeBuilder,
    solver,
  );

  const treeHash = await treeBuilder.finalize(repo);
  const parents = [ours.hash256, theirs.hash256];
  return { treeHash, parents };
}

async function threeWayMergeTree(
  repo: IndexRepository,
  base: Tree | undefined,
  ours: Tree,
  theirs: Tree,
  path: string[],
  treeBuilder: TreeBuilder,
  solver: ConflictSolver,
) {
  const allNameSet = [...ours.entries.keys(), ...theirs.entries.keys()]
    .reduce((prev, cur) => {
      prev.add(cur);
      return prev;
    }, new Set<string>())
    .values();
  for (const name of allNameSet) {
    const currentPath = [...path, name];
    const baseEntry = base?.entries.get(name);
    const ourEntry = ours.entries.get(name);
    const theirEntry = theirs.entries.get(name);
    if (
      baseEntry?.type === "mutateTree" ||
      ourEntry?.type === "mutateTree" ||
      theirEntry?.type === "mutateTree"
    ) {
      throw Error("Unexpected mutateTree type");
    }

    if (ourEntry !== undefined && theirEntry !== undefined) {
      if (
        (baseEntry === undefined || baseEntry.type === "t") &&
        ourEntry.type === "t" &&
        theirEntry.type === "t"
      ) {
        const baseChildTree: Tree | undefined = baseEntry?.hash
          ? await repo.readTree(baseEntry.hash)
          : undefined;
        const ourChildTree: Tree = ourEntry.hash
          ? await repo.readTree(ourEntry.hash)
          : { entries: new Map() };
        const theirChildTree: Tree = theirEntry.hash
          ? await repo.readTree(theirEntry.hash)
          : { entries: new Map() };
        await threeWayMergeTree(
          repo,
          baseChildTree,
          ourChildTree,
          theirChildTree,
          currentPath,
          treeBuilder,
          solver,
        );
        continue;
      }

      // conflict
      const solved = solver({ our: ourEntry, their: theirEntry });
      if (solved) {
        await treeBuilder.insertEntry(repo, currentPath, solved);
      }
    } else if (ourEntry !== undefined && theirEntry === undefined) {
      // added in ours (otherwise it was removed in theirs)
      // OR it was remove in theirs and modified in ours (in this case keep the modified version)
      if (baseEntry === undefined) {
        await treeBuilder.insertEntry(repo, currentPath, ourEntry);
      } else if (!isEntryEqual(baseEntry, ourEntry)) {
        const solved = solver({
          base: baseEntry,
          our: ourEntry,
          their: theirEntry,
        });
        if (solved) {
          await treeBuilder.insertEntry(repo, currentPath, solved);
        }
      }
    } else if (theirEntry !== undefined && ourEntry === undefined) {
      if (baseEntry === undefined) {
        await treeBuilder.insertEntry(repo, currentPath, theirEntry);
      } else if (!isEntryEqual(baseEntry, theirEntry)) {
        const solved = solver({
          base: baseEntry,
          our: ourEntry,
          their: theirEntry,
        });
        if (solved) {
          await treeBuilder.insertEntry(repo, currentPath, solved);
        }
      }
    }
  }
}

const isEntryEqual = (a: ReadEntry, b: ReadEntry) => {
  if (a.type !== b.type) {
    return false;
  }
  if (a.type === "b" && b.type === "b") {
    return arraysEqual(a.hash[1], b.hash[1]);
  }
  if (a.type === "t" && b.type === "t") {
    if (a.hash !== undefined && b.hash !== undefined) {
      return arraysEqual(a.hash[1], b.hash[1]);
    }
    return a.hash === b.hash;
  }
  if (a.type === "r" && b.type === "r") {
    return a.repoId === b.repoId;
  }
  return false;
};

/** Return blobs and trees missing ours */
async function collectBlobs(
  ours: IndexRepository,
  ourTree: Tree,
  ourTreeHash: Hash,
  results: {
    trees: { hash: Hash; tree: Tree }[];
    blobs: { hash: Hash; info: BlobInfo }[];
  },
) {
  results.trees.push({ hash: ourTreeHash, tree: ourTree });

  for (const ourEntry of ourTree.entries.values()) {
    if (ourEntry.type === TreeEntryType.Tree) {
      if (ourEntry.hash === undefined) {
        // don't collect empty trees
        continue;
      }
      const childTree =
        ourEntry.data !== undefined
          ? ourEntry.data
          : await ours.readTree(ourEntry.hash);

      await collectBlobs(ours, childTree, ourEntry.hash[1], results);
    } else if (ourEntry.type === TreeEntryType.Blob) {
      const blobInfo = await ours.readBlobInfo(ourEntry.hash[1]);
      results.blobs.push({ hash: ourEntry.hash[1], info: blobInfo });
    } else if (ourEntry.type === "mutateTree") {
      throw Error("Unexpected mutateTree type");
    }
  }
}

type RepoCommitInfo = {
  repo: IndexRepository;
  store: BlobStore;
  head: Snapshot | undefined;
  // all commits reachable from head
  commits: Map<string, Snapshot>;
};
export async function getRepoCommitInfo(
  branch: string,
  repo: IndexRepository,
  store: BlobStore,
): Promise<RepoCommitInfo> {
  const head = await repo.readBranchHead(branch);
  const commits =
    head !== undefined
      ? getRelatedCommits(head, await repo.listCommits())
      : new Map<string, Snapshot>();
  return {
    repo,
    store,
    head,
    commits,
  };
}

/** Returns the pulled commits */
export async function pullMissingBlobs(
  ours: RepoCommitInfo,
  theirs: RepoCommitInfo,
): Promise<Snapshot[]> {
  const missingCommits: Snapshot[] = [];
  for (const [hash, entry] of theirs.commits.entries()) {
    if (ours.commits.has(hash)) {
      continue;
    }
    missingCommits.push(entry);
  }

  for (const commit of missingCommits) {
    if (commit.tree === undefined) {
      continue;
    }
    const commitTree = await theirs.repo.readTree(commit.tree);
    const results: {
      trees: { hash: Hash; tree: Tree }[];
      blobs: { hash: Hash; info: BlobInfo }[];
    } = {
      trees: [],
      blobs: [],
    };
    await collectBlobs(theirs.repo, commitTree, commit.tree[1], results);

    for (const blob of results.blobs) {
      if (blob.info.type !== "inlined") {
        // transfer blobs fr
        for (const part of blob.info.parts) {
          const hex = arrayToHex(part);
          const path = Repository.blobPath(hex);
          if (await ours.store.exists(path)) {
            continue;
          }
          const cipherBlob = await theirs.store.read(path);
          await ours.store.write(path, cipherBlob);
        }
      }
      const existing = await ours.repo.readContent(blob.hash);
      if (existing === undefined) {
        await ours.repo.writeBlobInfo(blob.hash, blob.info);
      }
    }
    // Reverse, to write leaf trees first
    for (const tree of results.trees.reverse()) {
      await ours.repo.writeTree(
        tree.hash,
        Array.from(tree.tree.entries.entries()).map((it) => {
          if (it[1].type === "mutateTree") {
            throw Error("Unexpected entry type");
          }
          return {
            name: it[0],
            entry: it[1],
          };
        }),
      );
    }
    await ours.repo.writeSnapshot(
      commit.tree,
      commit.timestamp,
      commit.parents,
    );
  }

  return missingCommits;
}
