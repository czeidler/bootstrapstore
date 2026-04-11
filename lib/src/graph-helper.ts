import { BlobStore } from "./blob-store";
import { Hash } from "./hasher";
import { IndexRepository, Snapshot, TreeEntryType } from "./index-repository";
import { Repository } from "./repository";
import { BlobInfo, Tree } from "./tree-builder";
import { arrayToHex, hexToUint8Array } from "./utils";

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

export async function threeWayMerge(
  ours: Repository,
  theirs: Repository,
  baseCommit: Snapshot,
) {
  const base = await ours.branch(
    ours.config.branch,
    ours.config.inlined,
    baseCommit.hash256,
  );
  const ongoing: { path: string[] }[] = [{ path: [] }];
  while (ongoing.length > 0) {
    const current = ongoing.pop();
    if (current === undefined) {
      break;
    }
    const more = await threeWayMergePath(ours, theirs, base, current.path);
    ongoing.push(...more);
  }
}

async function threeWayMergePath(
  ours: Repository,
  theirs: Repository,
  base: Repository,
  path: string[],
): Promise<{ path: string[] }[]> {
  // TODO
  return [];
}

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
    // Revers to write leaf trees first
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
      commit.parents.map(hexToUint8Array),
    );
  }

  return missingCommits;
}
