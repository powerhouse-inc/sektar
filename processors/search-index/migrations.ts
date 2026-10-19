import type { IRelationalDb } from "@powerhousedao/reactor-browser";

export async function up(db: IRelationalDb<any>): Promise<void> {
  await db.schema
    .createTable("search_entries")
    .addColumn("document_id", "varchar(255)", (col) => col.notNull())
    .addColumn("entity_id", "varchar(255)", (col) => col.notNull())
    .addColumn("document_type", "varchar(255)", (col) => col.notNull())
    .addColumn("kind", "varchar(32)", (col) => col.notNull())
    .addColumn("title", "text", (col) => col.notNull())
    .addColumn("subtitle", "text")
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("amount", "double precision")
    .addColumn("status", "varchar(32)")
    .addColumn("at", "varchar(64)")
    .addPrimaryKeyConstraint("search_entries_pkey", [
      "document_id",
      "entity_id",
    ])
    .ifNotExists()
    .execute();
  await db.schema
    .createIndex("search_entries_body_idx")
    .on("search_entries")
    .column("body")
    .ifNotExists()
    .execute();
}

export async function down(db: IRelationalDb<any>): Promise<void> {
  await db.schema.dropTable("search_entries").execute();
}
