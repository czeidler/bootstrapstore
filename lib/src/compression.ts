export interface Compression {
  compress(plain: Buffer): Promise<Buffer>;
  decompress(data: Buffer): Promise<Buffer>;
}

type CompressionType =
  | "p" // plain
  | "b"; // brotli

/**
 * Annotates the compressed data with the type of compression
 */
export class AnnotatedCompression implements Compression {
  constructor(private parent: Compression) {}
  async compress(plain: Buffer): Promise<Buffer> {
    const deflated = await this.parent.compress(plain);
    return Buffer.concat([Uint8Array.from(["b".charCodeAt(0)]), deflated]);
  }

  async decompress(data: Buffer): Promise<Buffer> {
    const firstByte = data.at(0);
    if (firstByte === undefined) {
      return data;
    }
    const compressionType = String.fromCharCode(firstByte) as CompressionType;
    switch (compressionType) {
      case "b": {
        return Buffer.from(await this.parent.decompress(data.subarray(1)));
      }
      default: {
        throw Error(`Compression type ${compressionType} not supported`);
      }
    }
  }
}
