import type { BlobStore } from "lib";
import { tsr } from "./tsr";

export class HttpBlobStore implements BlobStore {
  constructor(
    private auth: { userId: string; sessionKey: string },
    private repoId?: string,
  ) {}

  async list(path: string[]): Promise<string[]> {
    const result = await tsr.list({
      query: { repoId: this.repoId, path, auth: this.auth },
    });
    if (result.status !== 200) {
      throw new Error(`HTTP error: ${result.status}`);
    }
    return result.body.content.map((it) => it.name);
  }

  async read(path: string[]): Promise<Uint8Array> {
    const result = await tsr.getFile({
      query: { repoId: this.repoId, path, auth: this.auth },
    });
    if (result.status !== 200) {
      throw new Error(`HTTP error: ${result.status}`);
    }
    const blob = result.body as Blob;
    return new Uint8Array(await blob.arrayBuffer());
  }

  async exists(path: string[]): Promise<boolean> {
    const result = await tsr.fileExists({
      query: { repoId: this.repoId, path, auth: this.auth },
    });
    if (result.status !== 200) {
      throw new Error(`HTTP error: ${result.status}`);
    }
    return result.body;
  }

  async write(path: string[], data: Uint8Array<ArrayBuffer>): Promise<void> {
    const result = await tsr.postBlob({
      query: { repoId: this.repoId, path, auth: this.auth },
      body: {
        blob: new File([data.buffer], "blob", {
          type: "application/octet-stream",
        }),
      },
    });
    if (result.status !== 201) {
      throw new Error(`HTTP error: ${result.status}`);
    }
  }
}
