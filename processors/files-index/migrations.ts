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
  // A reactor-drive's nodes resolve name collisions from the name asked for.
  try {
    await db.schema.alterTable("file_nodes").addColumn("requested_name", "text").execute();
  } catch {
    // there already
  }

  // The names of the documents a reactor-drive lists: a file node shows its
  // document's name, which the drive's own operations need not carry.
  await db.schema
    .createTable("doc_names")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull())
    .ifNotExists()
    .execute();

  // The drive's folder syncs, one row per mapping document.
  await db.schema
    .createTable("sync_mappings")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("name", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("drive_id", "varchar(255)")
    .addColumn("folder_id", "varchar(255)")
    .addColumn("folder_path", "text")
    .addColumn("local_path", "text")
    .addColumn("enabled", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("trigger", "varchar(16)", (c) => c.notNull().defaultTo("MANUAL"))
    .addColumn("include_subfolders", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("status", "varchar(16)", (c) => c.notNull().defaultTo("NEVER"))
    .addColumn("requested_at", "varchar(64)")
    .addColumn("last_run_started_at", "varchar(64)")
    .addColumn("last_run_finished_at", "varchar(64)")
    .addColumn("last_run_status", "varchar(16)")
    .addColumn("last_run_placeholders", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("last_run_error", "text")
    .addColumn("issue_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("pull_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("host_name", "text")
    .addColumn("updated_at", "varchar(64)", (c) => c.notNull())
    .ifNotExists()
    .execute();
}

export async function down(db: IRelationalDb<any>): Promise<void> {
  await db.schema.dropTable("sync_mappings").ifExists().execute();
  await db.schema.dropTable("doc_names").ifExists().execute();
  await db.schema.dropTable("file_docs").ifExists().execute();
  await db.schema.dropTable("file_nodes").ifExists().execute();
}
