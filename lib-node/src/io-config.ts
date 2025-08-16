import { RepoIOConfig } from "lib";
import { BrotliCompression } from "./compression-node";
import { BetterSqliteSerializableDB } from "./better-sqlite";

export function getRepoIOConfig(): RepoIOConfig {
  return {
    serializeDb: BetterSqliteSerializableDB,
    compression: new BrotliCompression(),
  };
}
