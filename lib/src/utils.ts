// Buffer.toString("hex") is not working in vite polyfill
export function bufferToHex(buffer: Buffer) {
  return arrayToHex(new Uint8Array(buffer));
}

export function arrayToHex(buffer: Uint8Array) {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class ExhaustiveCheckError extends Error {
  constructor(variant: never) {
    super(`Unexpected variant: ${variant}`);
  }
}
