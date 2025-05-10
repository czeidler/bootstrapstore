import { RepoIOConfig } from "lib/src/repository";
import { BrotliCompression } from "./compression-node";
import { BetterSqliteSerializableDB } from "./better-sqlite";

export function getRepoIOConfig(): RepoIOConfig {
  return {
    serializeDb: BetterSqliteSerializableDB,
    compression: new BrotliCompression(),
  };
}
