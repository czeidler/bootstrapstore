import { Compression } from "lib";

import brotli from "brotli-wasm";

/**
 * Annotates the compressed data with the type of compression
 */
export class BrotliCompression implements Compression {
  async compress(plain: Buffer): Promise<Buffer> {
    const deflated = (await brotli).compress(plain);
    return Buffer.from(deflated);
  }

  async decompress(data: Buffer): Promise<Buffer> {
    return Buffer.from((await brotli).decompress(data));
  }
}
