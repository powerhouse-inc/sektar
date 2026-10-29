import type { Kysely } from "kysely";
import type { DB } from "./schema.js";

// A plain Kysely is enough here: the processor passes its namespaced handle,
// the tests a database of their own.
export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("calendar_index")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("calendar_key", "text", (c) => c.notNull().defaultTo("|"))
    .addColumn("calendar_id", "text")
    .addColumn("calendar_account", "text")
    .addColumn("calendar_name", "text")
    .addColumn("calendar_label", "text", (c) => c.notNull().defaultTo("Calendar"))
    .addColumn("title", "text")
    .addColumn("location", "text")
    .addColumn("meeting_url", "text")
    .addColumn("start_at", "varchar(32)")
    .addColumn("end_at", "varchar(32)")
    .addColumn("start_date", "varchar(10)")
    .addColumn("end_date", "varchar(10)")
    .addColumn("time_zone", "varchar(64)")
    .addColumn("all_day", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("busy", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("tentative", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("status", "varchar(16)", (c) => c.notNull().defaultTo("CONFIRMED"))
    .addColumn("repeats", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("recurrence", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("recurrence_id", "text")
    .addColumn("uid", "text")
    .addColumn("series_id", "text")
    .addColumn("series_end", "varchar(32)")
    .addColumn("organizer_name", "text")
    .addColumn("organizer_email", "text")
    .addColumn("updated_at", "varchar(64)", (c) => c.notNull())
    .ifNotExists()
    .execute();

  // The week: one-off events by start, series by start (their end is open).
  await db.schema
    .createIndex("calendar_index_by_start")
    .on("calendar_index")
    .columns(["repeats", "start_at"])
    .ifNotExists()
    .execute();
  // A series' changed occurrences, looked up by the series.
  await db.schema
    .createIndex("calendar_index_by_series")
    .on("calendar_index")
    .column("series_id")
    .ifNotExists()
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("calendar_index").execute();
}
