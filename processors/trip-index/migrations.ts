import type { IRelationalDb } from "@powerhousedao/reactor-browser";
import type { DB } from "./schema.js";

export async function up(db: IRelationalDb<DB>): Promise<void> {
  await db.schema
    .createTable("trip_index")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("title", "text")
    .addColumn("status", "varchar(16)", (c) => c.notNull().defaultTo("PLANNED"))
    .addColumn("purpose_kind", "varchar(32)")
    .addColumn("start_date", "varchar(10)")
    .addColumn("end_date", "varchar(10)")
    .addColumn("traveler_name", "text")
    .addColumn("destinations", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("first_leg", "text")
    .addColumn("flights", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("legs", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("nights", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("days", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("cost_total", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("billed_total", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("cost_transport", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("cost_stays", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("cost_meals", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("cost_extras", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("currency", "varchar(16)", (c) => c.notNull().defaultTo("EUR"))
    .addColumn("search_text", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("updated_at", "varchar(64)", (c) => c.notNull())
    .ifNotExists()
    .execute();

  // A table made before these columns existed gains them; the rows keep
  // their zeros until the index is rebuilt.
  const tables = await db.introspection.getTables();
  // The drive's own schema: read off the SQL the namespaced builder writes.
  const schema = /"([^"]+)"\."trip_index"/.exec(
    db.selectFrom("trip_index").select("document_id").compile().sql,
  )?.[1];
  const have = new Set(
    tables
      .filter((t) => t.name === "trip_index" && (!schema || t.schema === schema))
      .flatMap((t) => t.columns.map((c) => c.name)),
  );
  if (!have.has("legs")) {
    await db.schema
      .alterTable("trip_index")
      .addColumn("legs", "integer", (c) => c.notNull().defaultTo(0))
      .execute();
  }
  for (const column of ["cost_transport", "cost_stays", "cost_meals", "cost_extras"] as const) {
    if (have.has(column)) continue;
    await db.schema
      .alterTable("trip_index")
      .addColumn(column, "double precision", (c) => c.notNull().defaultTo(0))
      .execute();
  }

  // The list: newest start first, offset-paged on (start_date, document_id).
  await db.schema
    .createIndex("trip_index_by_start")
    .on("trip_index")
    .columns(["start_date", "document_id"])
    .ifNotExists()
    .execute();
}

export async function down(db: IRelationalDb<DB>): Promise<void> {
  await db.schema.dropTable("trip_index").execute();
}
