import { RepoIOConfig } from "lib/src/repository";
import { BrotliCompression } from "./compression";
import { SqlocalSerializableDB } from "./sqlite";

export function getRepoIOConfig(): RepoIOConfig {
  return {
    serializeDb: SqlocalSerializableDB,
    compression: new BrotliCompression(),
  };
}
