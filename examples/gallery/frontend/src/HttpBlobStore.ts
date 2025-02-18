import type { BlobStore } from "lib";
import { tsr } from "./tsr";

export class HttpBlobStore implements BlobStore {
  constructor(private repoId: string) {}

  async list(path: string[]): Promise<string[]> {
    const result = await tsr.list.query({
      query: { repoId: this.repoId, path },
    });
    if (result.status !== 200) {
      throw Error(`HTTP error: ${result.status}`);
    }
    return result.body.content.map((it) => it.name);
  }

  async read(path: string[]): Promise<Buffer> {
    const result = await tsr.getFile.query({
      query: { repoId: this.repoId, path },
    });
    if (result.status !== 200) {
      throw Error(`HTTP error: ${result.status}`);
    }
    const blob = result.body as Blob;
    return Buffer.from(await blob.arrayBuffer());
  }

  async write(path: string[], data: Buffer): Promise<void> {
    const result = await tsr.postBlob.mutate({
      query: { repoId: this.repoId, path },
      body: {
        blob: new File([data], "blob", { type: "application/octet-stream" }),
      },
    });
    if (result.status !== 201) {
      throw Error(`HTTP error: ${result.status}`);
    }
  }
}
