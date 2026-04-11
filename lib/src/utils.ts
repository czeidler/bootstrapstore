export function concatArrayBuffers(buffers: Uint8Array[]) {
  const totalLength = buffers.reduce((acc, buf) => acc + buf.byteLength, 0);
  const resultArray = new Uint8Array(new ArrayBuffer(totalLength));

  let offset = 0;
  for (const buffer of buffers) {
    resultArray.set(new Uint8Array(buffer), offset);
    offset += buffer.byteLength;
  }

  return resultArray;
}

export function stringToUint8Array(string: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(string);
}

export function arrayToString(bytes: Uint8Array): string {
  const decoder = new TextDecoder("utf-8");
  return decoder.decode(bytes);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    binary += String.fromCharCode(...uint8Array.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function arrayToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToUint8Array(hex: string): Uint8Array {
  hex = hex.replace(/\s/g, ""); // Remove whitespace
  const bytes = hex.match(/.{2}/g);
  if (bytes === null) {
    throw Error(`Invalid hex string: ${hex}`);
  }
  return Uint8Array.from(bytes.map((byte) => parseInt(byte, 16)));
}

export function arraysEqual(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function shortId() {
  return arrayToHex(crypto.getRandomValues(new Uint8Array(12)));
}
export class ExhaustiveCheckError extends Error {
  constructor(variant: never) {
    super(`Unexpected variant: ${variant}`);
  }
}
