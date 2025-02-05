import sharp from "sharp";
import { Repository } from "lib";
import { BetterSqliteSerializableDB, FileBlobStore, scanDir } from "lib-node";
import { program } from "commander";
import { arrayToHex } from "lib/src/utils";

export async function snapshotDir(repo: Repository, dir: string) {
  await scanDir(dir, async (entryParts, blob) => {
    await repo.insertFile(entryParts, blob);
  });
  await repo.createSnapshot(new Date());
}

async function snapshotDirWithThumbnails(repo: Repository, dir: string) {
  await scanDir(dir, async (entryParts, blob) => {
    await repo.insertFile(entryParts, blob);
    const fileName = entryParts[entryParts.length - 1];
    if (fileName.endsWith(".jpg")) {
      const thumbnail = await sharp(blob)
        .rotate()
        .resize(600, 600, {
          fit: "contain",
          background: "rgba(256, 256, 256, 1.0)",
        })
        .jpeg({ mozjpeg: true })
        .toBuffer();
      console.log(
        `Thumbnail size: ${thumbnail.byteLength / 1024}kB, Original size: ${
          blob.byteLength / 1024
        }/kB`
      );
      await repo.insertFile(
        [...entryParts.slice(0, -1), ".thumbnails", fileName],
        thumbnail
      );
    }
  });
  await repo.createSnapshot(new Date());
}

async function snapshot({
  key,
  sourceDir,
  blobStoreDir,
}: {
  key: Buffer;
  sourceDir: string;
  blobStoreDir: string;
}) {
  const store = new FileBlobStore([blobStoreDir]);

  const repoId = arrayToHex(crypto.getRandomValues(new Uint8Array(12)));
  const repo = await Repository.create(
    repoId,
    BetterSqliteSerializableDB,
    store,
    [],
    {
      key,
      branch: "main",
      inlined: false,
    }
  );
  const start = Date.now();
  //await snapshotDir(repo, "./testData");
  await snapshotDirWithThumbnails(repo, sourceDir);
  console.log(`> Done in ${Date.now() - start} ms`);
}

program
  .requiredOption("--blobStoreDir <type>")
  .requiredOption("--sourceDir <type>")
  .requiredOption("--keyHex <type>");
program.parse();

const opts = program.opts<{
  blobStoreDir: string;
  sourceDir: string;
  keyHex: string;
}>();
console.log(opts);
const { sourceDir, blobStoreDir, keyHex } = opts;

snapshot({
  sourceDir,
  blobStoreDir,
  key: Buffer.from(keyHex, "hex"),
}).catch((e: unknown) => {
  console.error(e);
});
