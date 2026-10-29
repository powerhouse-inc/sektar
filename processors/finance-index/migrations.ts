import type { Kysely } from "kysely";
import type { DB } from "./schema.js";

const money = "double precision";
const stamp = "varchar(64)";

// A plain Kysely is enough here: the processor passes its namespaced handle,
// the tests a database of their own.
export async function up(db: Kysely<DB>): Promise<void> {
  await db.schema
    .createTable("invoice_index")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("direction", "varchar(16)", (c) => c.notNull())
    .addColumn("kind", "varchar(16)", (c) => c.notNull())
    .addColumn("status", "varchar(16)", (c) => c.notNull())
    .addColumn("number", "varchar(255)")
    .addColumn("is_draft", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("list_key", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("counterparty_name", "text")
    .addColumn("counterparty_contact_id", "varchar(255)")
    .addColumn("subject", "text")
    .addColumn("first_line", "text")
    .addColumn("currency", "varchar(8)", (c) => c.notNull())
    .addColumn("issued_at", stamp)
    .addColumn("due_at", stamp)
    .addColumn("delivered_at", stamp)
    .addColumn("period_start", stamp)
    .addColumn("period_end", stamp)
    .addColumn("created_at", stamp, (c) => c.notNull())
    .addColumn("gross", money, (c) => c.notNull().defaultTo(0))
    .addColumn("outstanding", money, (c) => c.notNull().defaultTo(0))
    .addColumn("book_gross", money, (c) => c.notNull().defaultTo(0))
    .addColumn("book_outstanding", money, (c) => c.notNull().defaultTo(0))
    .addColumn("book_rate_known", "boolean", (c) => c.notNull().defaultTo(true))
    .addColumn("issued_copy_id", "varchar(255)")
    .addColumn("issued_copy_ref", "text")
    .addColumn("line_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("lines_missing_attachments", "integer", (c) =>
      c.notNull().defaultTo(0),
    )
    .addColumn("last_paid_at", stamp)
    .addColumn("search_text", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("updated_at", stamp, (c) => c.notNull())
    .ifNotExists()
    .execute();

  // The views and the dashboard: open and overdue by direction.
  await db.schema
    .createIndex("invoice_index_by_status")
    .on("invoice_index")
    .columns(["direction", "status", "due_at"])
    .ifNotExists()
    .execute();
  await db.schema
    .createIndex("invoice_index_by_delivered")
    .on("invoice_index")
    .columns(["direction", "delivered_at desc"])
    .ifNotExists()
    .execute();
  await db.schema
    .createIndex("invoice_index_by_number")
    .on("invoice_index")
    .column("number")
    .ifNotExists()
    .execute();
  // The list's order: drafts first, then list_key descending.
  await db.schema
    .createIndex("invoice_index_by_list")
    .on("invoice_index")
    .columns(["direction", "is_draft desc", "list_key desc", "document_id desc"])
    .ifNotExists()
    .execute();

  await db.schema
    .createTable("account_index")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("name", "text")
    .addColumn("kind", "varchar(16)", (c) => c.notNull())
    .addColumn("institution", "text")
    .addColumn("iban_last4", "varchar(8)")
    .addColumn("currency", "varchar(8)", (c) => c.notNull())
    .addColumn("opening_balance", money, (c) => c.notNull().defaultTo(0))
    .addColumn("balance", money, (c) => c.notNull().defaultTo(0))
    .addColumn("tx_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("new_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("last_imported_at", stamp)
    .addColumn("updated_at", stamp, (c) => c.notNull())
    .ifNotExists()
    .execute();

  await db.schema
    .createTable("transaction_index")
    .addColumn("id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("account_id", "varchar(255)", (c) => c.notNull())
    .addColumn("booked_at", stamp, (c) => c.notNull())
    .addColumn("counterparty", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("description", "text")
    .addColumn("reference", "text")
    .addColumn("category", "varchar(32)", (c) => c.notNull())
    .addColumn("status", "varchar(16)", (c) => c.notNull())
    .addColumn("amount", money, (c) => c.notNull().defaultTo(0))
    .addColumn("currency", "varchar(8)", (c) => c.notNull())
    .addColumn("contact_id", "varchar(255)")
    .addColumn("matched_document_id", "varchar(255)")
    .addColumn("matched_kind", "varchar(16)")
    .addColumn("import_batch", "varchar(255)")
    .addColumn("search_text", "text", (c) => c.notNull().defaultTo(""))
    .ifNotExists()
    .execute();

  await db.schema
    .createIndex("transaction_index_by_booked")
    .on("transaction_index")
    .columns(["booked_at desc", "id desc"])
    .ifNotExists()
    .execute();
  await db.schema
    .createIndex("transaction_index_by_account")
    .on("transaction_index")
    .columns(["account_id", "booked_at desc"])
    .ifNotExists()
    .execute();
  await db.schema
    .createIndex("transaction_index_by_status")
    .on("transaction_index")
    .columns(["status", "booked_at desc"])
    .ifNotExists()
    .execute();
  await db.schema
    .createIndex("transaction_index_by_category")
    .on("transaction_index")
    .columns(["category", "booked_at desc"])
    .ifNotExists()
    .execute();

  // Added with the expense and contact tables. Every statement here runs on
  // each start, so a store made before them gains them in place; their rows
  // fill as their documents change (or on a replay).
  await db.schema
    .alterTable("invoice_index")
    .addColumn("our_party", "text", (c) => c.ifNotExists())
    .execute();
  // A contact's open invoices and its bank activity.
  await db.schema
    .createIndex("invoice_index_by_contact")
    .on("invoice_index")
    .columns(["counterparty_contact_id", "status"])
    .ifNotExists()
    .execute();
  await db.schema
    .createIndex("transaction_index_by_contact")
    .on("transaction_index")
    .columns(["contact_id", "booked_at desc"])
    .ifNotExists()
    .execute();

  await db.schema
    .createTable("expense_index")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("title", "text")
    .addColumn("submitter_name", "text")
    .addColumn("submitter_email", "text")
    .addColumn("status", "varchar(16)", (c) => c.notNull())
    .addColumn("currency", "varchar(8)", (c) => c.notNull())
    .addColumn("total", money, (c) => c.notNull().defaultTo(0))
    .addColumn("reimbursable", money, (c) => c.notNull().defaultTo(0))
    .addColumn("vat_total", money, (c) => c.notNull().defaultTo(0))
    .addColumn("item_count", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("categories", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("first_spent_at", stamp)
    .addColumn("submitted_at", stamp)
    .addColumn("decided_at", stamp)
    .addColumn("reimbursed_at", stamp)
    .addColumn("created_at", stamp, (c) => c.notNull())
    .addColumn("search_text", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("updated_at", stamp, (c) => c.notNull())
    .ifNotExists()
    .execute();
  // The board's columns, latest changed first.
  await db.schema
    .createIndex("expense_index_by_status")
    .on("expense_index")
    .columns(["status", "updated_at desc"])
    .ifNotExists()
    .execute();

  await db.schema
    .createTable("expense_item_index")
    .addColumn("report_id", "varchar(255)", (c) => c.notNull())
    .addColumn("id", "varchar(255)", (c) => c.notNull())
    .addColumn("spent_at", stamp, (c) => c.notNull())
    .addColumn("amount", money, (c) => c.notNull().defaultTo(0))
    .addColumn("category", "varchar(32)", (c) => c.notNull())
    .addColumn("paid_with", "varchar(16)", (c) => c.notNull())
    .addPrimaryKeyConstraint("expense_item_index_pk", ["report_id", "id"])
    .ifNotExists()
    .execute();
  await db.schema
    .createIndex("expense_item_index_by_spent")
    .on("expense_item_index")
    .column("spent_at")
    .ifNotExists()
    .execute();

  await db.schema
    .createTable("contact_index")
    .addColumn("document_id", "varchar(255)", (c) => c.primaryKey())
    .addColumn("name", "text")
    .addColumn("kind", "varchar(16)", (c) => c.notNull())
    .addColumn("status", "varchar(16)", (c) => c.notNull())
    .addColumn("email", "text")
    .addColumn("phone", "text")
    .addColumn("website", "text")
    .addColumn("vat_id", "text")
    .addColumn("registration_number", "text")
    .addColumn("street", "text")
    .addColumn("postal_code", "text")
    .addColumn("city", "text")
    .addColumn("country", "text")
    .addColumn("payment_terms_days", "integer", (c) => c.notNull().defaultTo(0))
    .addColumn("default_category", "varchar(32)", (c) => c.notNull())
    .addColumn("tags", "text", (c) => c.notNull().defaultTo("[]"))
    .addColumn("search_text", "text", (c) => c.notNull().defaultTo(""))
    .addColumn("updated_at", stamp, (c) => c.notNull())
    .ifNotExists()
    .execute();
}

export async function down(db: Kysely<DB>): Promise<void> {
  await db.schema.dropTable("contact_index").ifExists().execute();
  await db.schema.dropTable("expense_item_index").ifExists().execute();
  await db.schema.dropTable("expense_index").ifExists().execute();
  await db.schema.dropTable("transaction_index").ifExists().execute();
  await db.schema.dropTable("account_index").ifExists().execute();
  await db.schema.dropTable("invoice_index").ifExists().execute();
}
