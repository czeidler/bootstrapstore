import { SerializableDB } from "lib/src/sqlite";
import { SQLocalKysely } from "sqlocal/kysely";

export const SqlocalSerializableDB: SerializableDB = {
  create: async (buffer: Buffer | undefined) => {
    const { dialect, overwriteDatabaseFile, getDatabaseFile } =
      new SQLocalKysely(":memory:");
    if (buffer?.buffer) {
      await overwriteDatabaseFile(buffer?.buffer);
    }
    return {
      dialect,
      serialize: async () => {
        const file = await getDatabaseFile();
        return Buffer.from(await file.arrayBuffer());
      },
    };
  },
};
