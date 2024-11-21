import { createHash } from "crypto";

export interface Encryption {
  encrypt(plain: Buffer, key: Buffer): Promise<Buffer>;
  decrypt(cipher: Buffer, key: Buffer): Promise<Buffer>;
}

export class AESGCMEncryption implements Encryption {
  async encrypt(plain: Buffer, key: Buffer): Promise<Buffer> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      plain
    );

    return Buffer.concat([iv, new Uint8Array(cipher)]);
  }

  async decrypt(cipher: Buffer, key: Buffer): Promise<Buffer> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );
    const iv = cipher.subarray(0, 16);
    const encrypted = cipher.subarray(16);
    const data = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      cryptoKey,
      encrypted
    );
    return Buffer.from(data);
  }
}

export function sha256(data: Buffer): Buffer {
  return createHash("sha256").update(data).digest();
}
