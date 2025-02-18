import sharp from "sharp";
import { Repository } from "lib";
import { scanDir } from "lib-node";

export async function snapshotDir(repo: Repository, dir: string) {
  await scanDir(
    dir,
    async (entryParts, blob, creationTime, modificationTime) => {
      await repo.insertFile(entryParts, blob, creationTime, modificationTime);
    }
  );
  await repo.createSnapshot(new Date());
}

export async function snapshotDirWithThumbnails(repo: Repository, dir: string) {
  await scanDir(
    dir,
    async (entryParts, blob, creationTime, modificationTime) => {
      await repo.insertFile(entryParts, blob, creationTime, modificationTime);
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
        const now = Date.now();
        await repo.insertFile(
          [...entryParts.slice(0, -1), ".thumbnails", fileName],
          thumbnail,
          now,
          now
        );
      }
    }
  );
  await repo.createSnapshot(new Date());
}
