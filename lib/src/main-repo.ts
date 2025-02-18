import { BlobStoreGetter } from "./blob-store";
import { Repository } from "./repository";
import { SerializableDB } from "./sqlite";
import { arrayToHex } from "./utils";

type RepositoryInfo = {
  id: string;
  timestamp: string;
  encKey: string;
};

export class MainRepository {
  constructor(private rootRepo: Repository) {}

  async createChild(
    serializeDb: SerializableDB,
    storeGetter: BlobStoreGetter
  ): Promise<Repository> {
    const repoId = arrayToHex(crypto.getRandomValues(new Uint8Array(12)));
    const key = Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
    const repo = await Repository.create(repoId, serializeDb, storeGetter, {
      key,
      branch: "main",
      inlined: false,
    });

    const metaRepo = await this.rootRepo.branch(".metadata", true);
    const now = Date.now();
    await metaRepo.insertFile(
      ["repositories", repoId],
      Buffer.from(
        JSON.stringify({
          id: repoId,
          timestamp: new Date().toISOString(),
          encKey: key.toString("base64"),
        } satisfies RepositoryInfo)
      ),
      now,
      now
    );

    // TODO move to separate method?
    await metaRepo.createSnapshot(new Date());
    return repo;
  }

  async openChild(
    repoId: string,
    serializeDb: SerializableDB,
    storeGetter: BlobStoreGetter
  ): Promise<Repository | undefined> {
    const metaRepo = await this.rootRepo.branch(".metadata", true);
    const metadataBuf = await metaRepo.readFile(["repositories", repoId]);
    if (metadataBuf === undefined) {
      return undefined;
    }
    const repoInfo = JSON.parse(metadataBuf.toString()) as RepositoryInfo;
    const repo = Repository.open(repoId, serializeDb, storeGetter, {
      key: Buffer.from(repoInfo.encKey, "base64"),
      branch: "main",
      inlined: false,
    });
    return repo;
  }
}
