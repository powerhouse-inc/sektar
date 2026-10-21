import type { IRelationalDb } from "@powerhousedao/reactor-browser";

export async function up(db: IRelationalDb<any>): Promise<void> {
  await db.schema
    .createTable("file_nodes")
    .addColumn("id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("kind", "varchar(16)", (c) => c.notNull())
    .addColumn("name", "text", (c) => c.notNull())
    .addColumn("name_sort", "text", (c) => c.notNull())
    .addColumn("parent_id", "varchar(255)")
    .addColumn("document_type", "varchar(255)")
    .ifNotExists()
    .execute();
  // A folder's listing: folders first, then by name.
  await db.schema
    .createIndex("file_nodes_by_parent")
    .on("file_nodes")
    .columns(["parent_id", "kind", "name_sort"])
    .ifNotExists()
    .execute();
  // Every file of the drive, by name (a listing that includes subfolders).
  await db.schema
    .createIndex("file_nodes_by_kind")
    .on("file_nodes")
    .columns(["kind", "name_sort"])
    .ifNotExists()
    .execute();

  await db.schema
    .createTable("file_docs")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("title", "text")
    .addColumn("description", "text")
    .addColumn("tags", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("source_kind", "varchar(16)")
    .addColumn("source_mime", "varchar(255)")
    .addColumn("source_name", "text")
    .addColumn("source_size", "bigint")
    .addColumn("source_document_type", "varchar(255)")
    .addColumn("source_document_name", "text")
    .addColumn("rendition_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("thumb_ref", "varchar(512)")
    .addColumn("search_text", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("updated_at", "varchar(64)", (c) => c.notNull())
    .ifNotExists()
    .execute();

  // Added after the tables were first made: an index from before gets them here.
  // The placeholder source kinds are longer than the first column allowed.
  await db.schema.alterTable("file_docs").alterColumn("source_kind", (c) => c.setDataType("varchar(32)")).execute();
  try {
    await db.schema.alterTable("file_docs").addColumn("disk_change", "varchar(16)").execute();
  } catch {
    // there already
  }
}

export async function down(db: IRelationalDb<any>): Promise<void> {
  await db.schema.dropTable("file_docs").ifExists().execute();
  await db.schema.dropTable("file_nodes").ifExists().execute();
}
