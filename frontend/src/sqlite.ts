import { SerializableDB } from "lib";
import { SQLocalKysely } from "sqlocal/kysely";

export const SqlocalSerializableDB: SerializableDB = {
  create: async (buffer: Uint8Array | undefined) => {
    const { dialect, overwriteDatabaseFile, getDatabaseFile } =
      new SQLocalKysely(":memory:");
    if (buffer?.buffer) {
      await overwriteDatabaseFile(buffer);
    }
    return {
      dialect,
      serialize: async () => {
        const file = await getDatabaseFile();
        return new Uint8Array(await file.arrayBuffer());
      },
    };
  },
};
