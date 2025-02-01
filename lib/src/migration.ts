import { Kysely, Migration, Migrator } from "kysely";

const migrations: Record<string, Migration> = {
  "2024_11_11_init": {
    async up(db: Kysely<unknown>): Promise<void> {
      // trees or blobs clear text hashes
      await db.schema
        .createTable("content")
        .addColumn("id", "integer", (col) =>
          col.primaryKey().notNull().autoIncrement()
        )
        .addColumn("hash265", "blob", (col) => col.notNull())
        .execute();
      await db.schema
        .createIndex("content_hash265_index")
        .on("content")
        .column("hash265")
        .execute();

      await db.schema
        .createTable("tree_entry")
        .addColumn("id", "integer", (col) =>
          col.primaryKey().notNull().autoIncrement()
        )
        // The parent tree blob id
        .addColumn("tree_id", "integer", (col) =>
          col.references("content.id").notNull()
        )
        .addColumn("name", "varchar", (col) => col.notNull())
        // b | t (blob or tree)
        .addColumn("type", "varchar", (col) => col.notNull())
        // The content blob id
        .addColumn("content_id", "integer", (col) =>
          col.references("content.id").notNull()
        )
        .execute();

      // Information about where blobs are stored
      await db.schema
        .createTable("blob")
        .addColumn("id", "integer", (col) =>
          col.primaryKey().notNull().autoIncrement()
        )
        .addColumn("content_id", "integer", (col) =>
          col.references("content.id").notNull()
        )
        // The encryption key. If null data is not encrypted
        .addColumn("enc_key", "blob")
        .execute();
      // An encrypted blob can be split in multiple parts
      await db.schema
        .createTable("blob_part")
        .addColumn("id", "integer", (col) =>
          col.primaryKey().notNull().autoIncrement()
        )
        .addColumn("blob_id", "integer", (col) =>
          col.references("blob.id").notNull()
        )
        // Index of the part
        .addColumn("index", "integer", (col) => col.notNull())
        // Lookup key of externally stored data part. Usually, the hash of the encrypted blob part. If null data is
        // stored in the data column.
        .addColumn("key", "blob")
        // Inlined blob part data. If null data is stored outside of the database and can be found by the hash value.
        .addColumn("data", "blob")
        .execute();

      await db.schema
        .createTable("commit")
        .addColumn("id", "integer", (col) =>
          col.primaryKey().notNull().autoIncrement()
        )
        .addColumn("hash256", "blob", (col) => col.notNull())
        // root tree hash
        .addColumn("tree_content_id", "integer", (col) =>
          col.references("content.id").notNull()
        )
        .addColumn("timestamp", "timestamp", (col) => col.notNull())
        .addColumn("parents", "varchar", (col) => col.notNull())
        .execute();

      await db.schema
        .createTable("branch")
        .addColumn("id", "integer", (col) =>
          col.primaryKey().notNull().autoIncrement()
        )
        .addColumn("name", "text", (col) => col.notNull().unique())
        .addColumn("commit_id", "integer", (col) =>
          col.references("commit.id").notNull()
        )
        .execute();
    },
  },
};

export async function migrateToLatest(db: Kysely<unknown>) {
  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations() {
        return migrations;
      },
    },
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      console.log(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === "Error") {
      console.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error("failed to migrate");
    console.error(error);
    process.exit(1);
  }
}
