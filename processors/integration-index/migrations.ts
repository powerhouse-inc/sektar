import type { IRelationalDb } from "@powerhousedao/reactor-browser";
import type { DB } from "./schema.js";

export async function up(db: IRelationalDb<DB>): Promise<void> {
  await db.schema
    .createTable("integration_index")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("name", "text")
    .addColumn("kind", "varchar(32)")
    .addColumn("provider", "varchar(64)")
    .addColumn("archived", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("live_enabled", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("backfill_enabled", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("live_workflow_id", "varchar(255)")
    .addColumn("backfill_workflow_id", "varchar(255)")
    .addColumn("connection_id", "varchar(255)")
    .addColumn("mailbox", "text")
    .addColumn("address", "text")
    .addColumn("queue_ids", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("state", "text", (c) => c.notNull().defaultTo("{}"))
    .addColumn("updated_at", "varchar(64)", (c) => c.notNull())
    .ifNotExists()
    .execute();

  await db.schema
    .createTable("queue_index")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("name", "text")
    .addColumn("status", "varchar(16)", (c) => c.notNull().defaultTo("DRAFT"))
    .addColumn("description", "text")
    .addColumn("loops", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("total", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("progress", "double precision", (c) => c.notNull().defaultTo(0))
    .addColumn("iteration", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("done", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("finished", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("awaiting_values", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("error_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("last_error", "text")
    .addColumn("search_text", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("updated_at", "varchar(64)", (c) => c.notNull())
    .ifNotExists()
    .execute();

  await db.schema
    .createTable("connection_index")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("name", "text")
    .addColumn("connector_id", "text")
    .addColumn("account_label", "text")
    .addColumn("status", "varchar(16)")
    .addColumn("last_checked_at", "varchar(64)")
    .addColumn("last_error", "text")
    .addColumn("updated_at", "varchar(64)", (c) => c.notNull())
    .ifNotExists()
    .execute();
}

export async function down(db: IRelationalDb<DB>): Promise<void> {
  await db.schema.dropTable("connection_index").ifExists().execute();
  await db.schema.dropTable("queue_index").ifExists().execute();
  await db.schema.dropTable("integration_index").ifExists().execute();
}
