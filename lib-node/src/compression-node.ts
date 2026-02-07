import { BrotliWasmType } from "brotli-wasm";
import { Compression } from "lib";

// IMPORTANT: we need to use require otherwise the web version of brotli is selected!
// eslint-disable-next-line @typescript-eslint/no-require-imports
const brotli = require("brotli-wasm") as Promise<BrotliWasmType>;

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
