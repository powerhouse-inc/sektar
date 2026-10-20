import type { IRelationalDb } from "@powerhousedao/reactor-browser";

export async function up(db: IRelationalDb<any>): Promise<void> {
  await db.schema
    .createTable("key_index")
    .addColumn("document_type", "varchar(255)", (c) => c.notNull())
    .addColumn("key", "varchar(512)", (c) => c.notNull())
    .addColumn("document_id", "varchar(255)", (c) => c.notNull())
    // The pair: the same key captured twice is two documents, not a conflict.
    .addPrimaryKeyConstraint("key_index_pkey", ["document_id", "key"])
    .ifNotExists()
    .execute();

  // The lookup this table exists for: by type and key.
  await db.schema
    .createIndex("key_index_by_key")
    .on("key_index")
    .columns(["document_type", "key"])
    .ifNotExists()
    .execute();
}

export async function down(db: IRelationalDb<any>): Promise<void> {
  await db.schema.dropTable("key_index").execute();
}
