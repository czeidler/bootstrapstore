import { concatArrayBuffers } from "./utils";

export interface Compression {
  compress(plain: Uint8Array): Promise<Uint8Array>;
  decompress(data: Uint8Array): Promise<Uint8Array>;
}

type CompressionType =
  | "p" // plain
  | "b"; // brotli

/**
 * Annotates the compressed data with the type of compression
 */
export class AnnotatedCompression implements Compression {
  constructor(private parent: Compression) {}
  async compress(plain: Uint8Array): Promise<Uint8Array> {
    const deflated = await this.parent.compress(plain);
    return concatArrayBuffers([Uint8Array.from(["b".charCodeAt(0)]), deflated]);
  }

  async decompress(data: Uint8Array): Promise<Uint8Array> {
    const firstByte = data.at(0);
    if (firstByte === undefined) {
      return data;
    }
    const compressionType = String.fromCharCode(firstByte) as CompressionType;
    switch (compressionType) {
      case "b": {
        return await this.parent.decompress(data.subarray(1));
      }
      default: {
        throw Error(`Compression type ${compressionType} not supported`);
      }
    }
  }
}
