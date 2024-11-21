import { SessionUser } from "./session-store";
import { TRPCProxyClient } from "./trpc";
import { createHash } from "crypto";

export type AESKey = {
  /** base64 key */
  key: string;
};

export type FileEntry = {
  /** Encryption key */
  keyId: number;
  /** Hash of the encrypted blob */
  hash: string;
};

export type Manifest = {
  keys: Record<number, AESKey>;
  /** File path to file information */
  files: Record<string, FileEntry>;
};

/** Get or generates a new `age` key at the provided index */
function getOrGenerateAgeKey(index: number, manifest: Manifest): AESKey {
  const existing = manifest.keys[index];
  if (existing !== undefined) {
    return existing;
  }
  const key: AESKey = {
    key: Buffer.from(
      window.crypto.getRandomValues(new Uint8Array(16))
    ).toString("base64"),
  };
  manifest.keys[index] = key;
  return key;
}

async function encryptAESGCM(keyBase64: string, data: Buffer): Promise<Buffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    Buffer.from(keyBase64, "base64").subarray(0, 16),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(16));
  const cipher = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    cryptoKey,
    data
  );

  return Buffer.concat([iv, new Uint8Array(cipher)]);
}

async function decryptAESGCM(
  keyBase64: string,
  cipher: Buffer
): Promise<Buffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    Buffer.from(keyBase64, "base64").subarray(0, 16),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const iv = cipher.subarray(0, 16);
  const encrypted = cipher.subarray(16);

  const data = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    cryptoKey,
    encrypted
  );
  return Buffer.from(data);
}

const manifestKey = "manifest";

async function encryptManifest(
  user: SessionUser,
  manifest: Manifest
): Promise<Buffer> {
  return encryptAESGCM(user.exportKey, Buffer.from(JSON.stringify(manifest)));
}

async function decryptManifest(
  user: SessionUser,
  cipher: Buffer
): Promise<Manifest> {
  const data = await decryptAESGCM(user.exportKey, cipher);
  return JSON.parse(data.toString());
}

/**
 * Encrypts file and updates provided manifest
 */
async function encryptFile(
  manifest: Manifest,
  keyIndex: number,
  data: Uint8Array
): Promise<{ hash: string; cipher: Buffer }> {
  const key = getOrGenerateAgeKey(keyIndex, manifest);
  const cipher = await encryptAESGCM(key.key, Buffer.from(data));

  const hash = createHash("sha256").update("bacon").digest("hex");
  return { hash, cipher };
}

/**
 * Encrypts file
 */
async function decryptFile(
  manifest: Manifest,
  name: string,
  cipher: Buffer
): Promise<Buffer> {
  const file = manifest.files[name];
  if (file === undefined) {
    throw Error("File not found");
  }
  const key = manifest.keys[file.keyId];
  if (key === undefined) {
    throw Error("Key not found");
  }

  return decryptAESGCM(key.key, cipher);
}

/**
 * Mutates files
 *
 * Deletes old version of updated files.
 *
 * @param manifest current manifest
 * @param updates list of files to be updated
 * @param deleteNames list of plain text file name to be deleted
 * @returns the updated manifest
 */
export async function mutateFiles(
  client: TRPCProxyClient,
  user: SessionUser,
  manifest: Manifest,
  updates: Record<string, Uint8Array>,
  deleteNames: string[]
): Promise<Manifest> {
  const manifestCopy: Manifest = JSON.parse(JSON.stringify(manifest));

  const pendingDeletes: string[] = [];
  const pendingUpdates: Record<string, string> = {};
  const keyIndex = 0;
  for (const [name, data] of Object.entries(updates)) {
    const { hash, cipher } = await encryptFile(manifestCopy, keyIndex, data);
    const existing = manifestCopy.files[name];
    if (existing) {
      pendingDeletes.push(existing.hash);
    }
    manifestCopy.files[name] = { keyId: keyIndex, hash };
    pendingUpdates[hash] = cipher.toString("base64");
  }
  for (const deleteName of deleteNames) {
    const existing = manifestCopy.files[deleteName];
    if (!existing) {
      continue;
    }
    pendingDeletes.push(existing.hash);
    delete manifestCopy.files[deleteName];
  }

  // Upload the manifest as well
  const manifestCipher = await encryptManifest(user, manifestCopy);
  pendingUpdates[manifestKey] = Buffer.from(manifestCipher).toString("base64");

  await client.mutateFiles.mutate({
    auth: { userId: user.userId, sessionKey: user.sessionKey },
    updates: pendingUpdates,
    deletes: pendingDeletes,
  });

  return manifestCopy;
}

export async function getFile(
  client: TRPCProxyClient,
  user: SessionUser,
  manifest: Manifest,
  name: string
): Promise<Buffer> {
  const file = manifest.files[name];
  if (file === undefined) {
    throw Error("File not in manifest");
  }
  const cipherBase64 = await client.getFile.query({
    auth: { userId: user.userId, sessionKey: user.sessionKey },
    name: file.hash,
  });
  if (cipherBase64 === undefined) {
    throw Error("File not found");
  }
  const cipher = Buffer.from(cipherBase64, "base64");
  return decryptFile(manifest, name, cipher);
}

export async function getManifest(
  client: TRPCProxyClient,
  user: SessionUser
): Promise<Manifest> {
  const cipherBase64 = await client.getFile.query({
    auth: { userId: user.userId, sessionKey: user.sessionKey },
    name: manifestKey,
  });
  if (cipherBase64 === undefined) {
    return {
      keys: {},
      files: {},
    };
  }
  return decryptManifest(user, Buffer.from(cipherBase64, "base64"));
}
