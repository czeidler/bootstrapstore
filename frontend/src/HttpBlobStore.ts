import type { BlobStore } from "lib";
import { client } from "./client";

export class HttpBlobStore implements BlobStore {
  constructor(
    private auth: { userId: string; sessionKey: string },
    private repoId?: string,
  ) {}

  async list(path: string[]): Promise<string[]> {
    const result = await client.list({
      repoId: this.repoId,
      path,
      auth: this.auth,
    });
    return result.content.map((it) => it.name);
  }

  async read(path: string[]): Promise<Uint8Array> {
    const result = await client.getFile({
      repoId: this.repoId,
      path,
      auth: this.auth,
    });
    return new Uint8Array(await result.file.arrayBuffer());
  }

  async exists(path: string[]): Promise<boolean> {
    const result = await client.fileExists({
      repoId: this.repoId,
      path,
      auth: this.auth,
    });
    return result;
  }

  async write(path: string[], data: Uint8Array<ArrayBuffer>): Promise<void> {
    await client.postBlob({
      repoId: this.repoId,
      path,
      auth: this.auth,
      blob: new File([data.buffer], "blob", {
        type: "application/octet-stream",
      }),
    });
  }
}
