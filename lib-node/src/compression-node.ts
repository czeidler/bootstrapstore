import { BrotliWasmType } from "brotli-wasm";
import { Compression } from "lib/src/compression";

// IMPORTANT: we need to use require otherwise the web version of brotli is selected!
// eslint-disable-next-line @typescript-eslint/no-require-imports
const brotli = require("brotli-wasm") as Promise<BrotliWasmType>;

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
