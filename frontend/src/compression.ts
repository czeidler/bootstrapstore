import { Compression } from "lib";

import brotli from "brotli-wasm";

/**
 * Annotates the compressed data with the type of compression
 */
export class BrotliCompression implements Compression {
  async compress(plain: Uint8Array): Promise<Uint8Array> {
    const deflated = (await brotli).compress(plain);
    return deflated;
  }

  async decompress(data: Uint8Array): Promise<Uint8Array> {
    return (await brotli).decompress(data);
  }
}
