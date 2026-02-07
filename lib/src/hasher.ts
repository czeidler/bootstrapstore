import { concatArrayBuffers } from "./utils";

export type Hash = Uint8Array;

export type HashPart = {
  key: string;
  value: Uint8Array | string | Date | number;
};

export async function hashParts(parts: HashPart[]): Promise<Hash> {
  const encoder = new TextEncoder();
  const all = parts.reduce<Uint8Array[]>((prev, cur) => {
    prev.push(encoder.encode(cur.key));
    if (typeof cur.value === "string") {
      prev.push(encoder.encode(cur.key));
    } else if (cur.value instanceof Date) {
      prev.push(encoder.encode(cur.value.toISOString()));
    } else if (typeof cur.value === "number") {
      // TODO directly convert to buffer?
      prev.push(encoder.encode(`${cur.value}`));
    } else {
      prev.push(cur.value);
    }
    return prev;
  }, []);
  const hashArray = await crypto.subtle.digest(
    "SHA-256",
    concatArrayBuffers(all),
  );
  return new Uint8Array(hashArray);
}
