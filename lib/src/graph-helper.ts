import { BlobStore } from "./blob-store";
import { Hash } from "./hasher";
import { IndexRepository, Snapshot, TreeEntryType } from "./index-repository";
import { Repository } from "./repository";
import { DBHash, ReadEntry, Tree, TreeBuilder } from "./tree-builder";
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

  const commitsLDesc = Array.from(commitsLeft.entries());
  commitsLDesc.sort(
    (a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime(),
  );

  for (const commitLeft of commitsLDesc) {
    if (commitsRight.has(commitLeft[0])) {
      return commitLeft[1];
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

async function pullTree(
  ours: RepoCommitInfo,
  their: RepoCommitInfo,
  theirTreeHash: DBHash,
): Promise<DBHash> {
  const tree: Tree = { entries: new Map() };

  const theirTree = await their.repo.readTree(theirTreeHash);
  for (const [name, entry] of theirTree.entries.entries()) {
    switch (entry.type) {
      case TreeEntryType.Tree: {
        if (entry.hash === undefined) {
          tree.entries.set(name, entry);
          continue;
        }
        const childTreeHash = await pullTree(ours, their, entry.hash);
        tree.entries.set(name, {
          type: TreeEntryType.Tree,
          hash: childTreeHash,
          data: undefined,
        });
        break;
      }
      case TreeEntryType.Blob: {
        const blobInfo = await their.repo.readBlobInfo(entry.hash[1]);
        if (blobInfo.type !== "inlined") {
          // transfer blobs fr
          for (const part of blobInfo.parts) {
            const hex = arrayToHex(part);
            const path = Repository.blobPath(hex);
            if (await ours.store.exists(path)) {
              continue;
            }
            const cipherBlob = await their.store.read(path);
            await ours.store.write(path, cipherBlob);
          }
        }
        const existing = await ours.repo.readContent(entry.hash[1]);
        const ourBlobHash =
          existing !== undefined
            ? existing
            : await ours.repo.writeBlobInfo(entry.hash[1], blobInfo);
        tree.entries.set(name, {
          ...entry,
          hash: ourBlobHash,
        });

        break;
      }
      case TreeEntryType.RepoLink:
        tree.entries.set(name, entry);
        break;
      case "mutateTree":
        throw Error("Unexpected mutateTree type");
      default:
        entry satisfies never;
    }
  }

  return ours.repo.writeTree(
    theirTreeHash[1],
    Array.from(tree.entries.entries()).map((it) => {
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

/** Returns the pulled commits */
export async function pullMissingBlobs(
  ours: RepoCommitInfo,
  theirs: RepoCommitInfo,
): Promise<Hash[]> {
  const missingCommits: Snapshot[] = [];
  for (const [hash, entry] of theirs.commits.entries()) {
    if (ours.commits.has(hash)) {
      continue;
    }
    missingCommits.push(entry);
  }

  for (const commit of missingCommits) {
    const treeHash =
      commit.tree === undefined
        ? undefined
        : await pullTree(ours, theirs, commit.tree);
    await ours.repo.writeSnapshot(treeHash, commit.timestamp, commit.parents);
  }

  return missingCommits.map((it) => it.hash256);
}
