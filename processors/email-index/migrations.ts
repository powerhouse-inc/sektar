import type { IRelationalDb } from "@powerhousedao/reactor-browser";

export async function up(db: IRelationalDb<any>): Promise<void> {
  await db.schema
    .createTable("email_index")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("captured", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("account_address", "varchar(320)")
    .addColumn("account_name", "text")
    .addColumn("account_provider", "varchar(64)")
    .addColumn("subject", "text")
    .addColumn("from_name", "text")
    .addColumn("from_address", "varchar(320)")
    .addColumn("snippet", "text")
    .addColumn("when_at", "varchar(64)", (c) => c.notNull())
    .addColumn("sent_at", "varchar(64)")
    .addColumn("received_at", "varchar(64)")
    .addColumn("read", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("flagged", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("status", "varchar(16)", (c) => c.notNull().defaultTo("INBOX"))
    .addColumn("attachments", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("attachment_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("labels", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("thread_id", "varchar(255)")
    .addColumn("participants", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("search_text", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("updated_at", "varchar(64)", (c) => c.notNull())
    .ifNotExists()
    .execute();

  // The list: newest first, keyset-paged on (when_at, document_id).
  await db.schema
    .createIndex("email_index_by_when")
    .on("email_index")
    .columns(["when_at", "document_id"])
    .ifNotExists()
    .execute();

  // One mailbox's list and counts.
  await db.schema
    .createIndex("email_index_by_account")
    .on("email_index")
    .columns(["account_address", "when_at"])
    .ifNotExists()
    .execute();
}

export async function down(db: IRelationalDb<any>): Promise<void> {
  await db.schema.dropTable("email_index").execute();
}
