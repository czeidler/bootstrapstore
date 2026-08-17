import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("user")
    .addColumn("id", "text", (col) => col.primaryKey().notNull())
    .addColumn("created_at", "text", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("user_name", "text", (col) => col.notNull())
    .addColumn("email", "text")
    // Only set if the user is child of another user (service account)
    .addColumn("parent_id", "integer", (col) => col.references("user.id"))
    // opaque record
    .addColumn("registration_record", "text")
    .execute();

  await db.schema
    .createTable("account")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().notNull().autoIncrement(),
    )
    .addColumn("created_at", "text", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("owner_id", "text", (col) => col.references("user.id").notNull())
    .execute();

  await db.schema
    .createTable("permission")
    .addColumn("id", "integer", (col) =>
      col.primaryKey().notNull().autoIncrement(),
    )
    .addColumn("created_at", "text", (col) =>
      col.defaultTo(sql`CURRENT_TIMESTAMP`).notNull(),
    )
    .addColumn("user_id", "text", (col) => col.references("user.id").notNull())
    .addColumn("account_id", "integer", (col) =>
      col.references("account.id").notNull(),
    )
    .addColumn("permission", "text", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("permission");
  await db.schema.dropTable("account");
  await db.schema.dropTable("user");
}
