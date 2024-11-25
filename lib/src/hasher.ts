export type Hash = Buffer;

export type HashPart = { key: string; value: Buffer | string | Date };

export async function hashParts(parts: HashPart[]): Promise<Hash> {
  const all = parts.reduce<Buffer[]>((prev, cur) => {
    prev.push(Buffer.from(cur.key, "utf8"));
    if (typeof cur.value === "string") {
      prev.push(Buffer.from(cur.key, "utf8"));
    } else if (cur.value instanceof Date) {
      prev.push(Buffer.from(cur.value.toISOString(), "utf8"));
    } else {
      prev.push(cur.value);
    }
    return prev;
  }, []);
  const hashArray = await crypto.subtle.digest("SHA-256", Buffer.concat(all));
  const hash = Buffer.from(hashArray);
  return hash;
}
