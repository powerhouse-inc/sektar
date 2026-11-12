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
    .addColumn("currency", "varchar(8)")
    .addColumn("status", "varchar(32)")
    .addColumn("at", "varchar(64)")
    .addPrimaryKeyConstraint("search_entries_pkey", [
      "document_id",
      "entity_id",
    ])
    .ifNotExists()
    .execute();
  // A table made before a hit carried its currency gains the column; its
  // rows keep null until their documents next change.
  const tables = await db.introspection.getTables();
  // The drive's own schema: read off the SQL the namespaced builder writes.
  const schema = /"([^"]+)"\."search_entries"/.exec(
    db.selectFrom("search_entries").select("document_id").compile().sql,
  )?.[1];
  const have = new Set(
    tables
      .filter((t) => t.name === "search_entries" && (!schema || t.schema === schema))
      .flatMap((t) => t.columns.map((c) => c.name)),
  );
  if (!have.has("currency")) {
    await db.schema
      .alterTable("search_entries")
      .addColumn("currency", "varchar(8)")
      .execute();
  }

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
