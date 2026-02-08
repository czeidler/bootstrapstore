import { createHash } from "crypto";

export interface Encryption {
  encrypt(plain: Uint8Array, key: Uint8Array): Promise<Uint8Array>;
  decrypt(cipher: Uint8Array, key: Uint8Array): Promise<Uint8Array>;
}

export class AESGCMEncryption implements Encryption {
  async encrypt(plain: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );
    const ivLength = 16;
    const iv = crypto.getRandomValues(new Uint8Array(ivLength));
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      plain,
    );

    const result = new Uint8Array(
      new ArrayBuffer(ivLength + cipher.byteLength),
    );
    result.set(iv);
    result.set(new Uint8Array(cipher), ivLength);
    return result;
  }

  async decrypt(cipher: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const iv = cipher.subarray(0, 16);
    const encrypted = cipher.subarray(16);
    try {
      const data = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        encrypted,
      );
      return new Uint8Array(data);
    } catch (e) {
      console.error(e);
      throw e;
    }
  }
}

export function sha256(data: Uint8Array): Uint8Array {
  return createHash("sha256").update(data).digest();
}
