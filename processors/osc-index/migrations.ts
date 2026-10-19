import type { IRelationalDb } from "@powerhousedao/reactor-browser";

export async function up(db: IRelationalDb<any>): Promise<void> {
  await db.schema
    .createTable("osc_identifier")
    .addColumn("identifier", "varchar(512)", (c) => c.notNull())
    .addColumn("document_id", "varchar(255)", (c) => c.notNull())
    .addColumn("source_id", "varchar(255)", (c) => c.notNull())
    .addColumn("is_alias", "boolean", (c) => c.notNull())
    .addColumn("status", "varchar(32)", (c) => c.notNull())
    .addColumn("title", "varchar(1024)")
    .addColumn("captured_at", "varchar(64)", (c) => c.notNull())
    .addColumn("last_seen_at", "varchar(64)", (c) => c.notNull())
    .addColumn("collection_title", "varchar(1024)")
    // The pair, not the identifier alone: the same object may have been
    // captured separately by two backfills, and that is not a conflict.
    .addPrimaryKeyConstraint("osc_identifier_pkey", [
      "document_id",
      "identifier",
    ])
    .ifNotExists()
    .execute();

  // The lookup this table exists for goes the other way round.
  await db.schema
    .createIndex("osc_identifier_by_identifier")
    .on("osc_identifier")
    .column("identifier")
    .ifNotExists()
    .execute();
}

export async function down(db: IRelationalDb<any>): Promise<void> {
  await db.schema.dropTable("osc_identifier").execute();
}
