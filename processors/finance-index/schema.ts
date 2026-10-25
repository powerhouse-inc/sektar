/**
 * The finance index: one lean row per invoice, per bank account and per
 * transaction.
 *
 * The Finances dashboard, the Invoices list and the Transactions table show
 * rows and sums, never whole documents. An account document carries every
 * transaction ever imported, and an invoice its lines, parties and files;
 * loading all of them to draw a list or add up a balance is what made the
 * boards slow. The index holds what a row shows and what a filter, an order
 * or a sum needs; a document is loaded only when it is opened for editing.
 *
 * Rows come off the operations' resulting state (see `rows.ts`), so a history
 * replay on first install walks the operations once without loading a
 * document. Amounts are `double precision`: the documents hold them as
 * floats, and the boards add them up in JavaScript numbers.
 */
export interface InvoiceRow {
  document_id: string;
  /** OUTGOING | INCOMING */
  direction: string;
  /** INVOICE | CREDIT_NOTE */
  kind: string;
  /** DRAFT | OPEN | PAID | VOID */
  status: string;
  number: string | null;
  /** True while the invoice has no number: the list puts drafts first. */
  is_draft: boolean;
  /**
   * The list's order within drafts or within issued, both descending: a
   * draft's delivery date, else its period's end, else start, else when it
   * was made; an issued invoice's number with every digit run zero-padded,
   * lower-cased, so "INV-10" sorts after "INV-9" as the workspace sorts.
   */
  list_key: string;
  /** The other party: the buyer of a sale, the seller of a bill. */
  counterparty_name: string | null;
  counterparty_contact_id: string | null;
  subject: string | null;
  /** The first line's description: what the row shows when there is no subject. */
  first_line: string | null;
  currency: string;
  issued_at: string | null;
  due_at: string | null;
  delivered_at: string | null;
  period_start: string | null;
  period_end: string | null;
  /** When the document was made: the first operation the index saw for it. */
  created_at: string;
  /** In the invoice's currency, from `computeTotals`. */
  gross: number;
  /** What is still to be paid, never below zero, in the invoice's currency. */
  outstanding: number;
  /** `gross` in the book currency, at the invoice's own rate when it has one. */
  book_gross: number;
  book_outstanding: number;
  /** False when the invoice has no rate to the book currency: the book amounts are unconverted. */
  book_rate_known: boolean;
  /** The ISSUED_COPY attachment: what the third column opens on. */
  issued_copy_id: string | null;
  issued_copy_ref: string | null;
  line_count: number;
  /** Lines with no attachment: "n without a receipt". */
  lines_missing_attachments: number;
  /** The last payment's date, as the row's "paid …" shows it. */
  last_paid_at: string | null;
  /** Lower-cased haystack: number, counterparty, subject, buyer reference, gross. */
  search_text: string;
  updated_at: string;
}

export interface AccountRow {
  document_id: string;
  name: string | null;
  /** CURRENT | SAVINGS | CREDIT_CARD */
  kind: string;
  institution: string | null;
  iban_last4: string | null;
  currency: string;
  opening_balance: number;
  /** Opening balance plus every transaction not EXCLUDED, as `accountBalance` adds it. */
  balance: number;
  tx_count: number;
  /** Transactions still NEW: to review. */
  new_count: number;
  last_imported_at: string | null;
  updated_at: string;
}

export interface TransactionRow {
  /** The transaction's own id (unique: generated on import). */
  id: string;
  /** The account document that holds it. */
  account_id: string;
  booked_at: string;
  counterparty: string;
  description: string | null;
  reference: string | null;
  /** TransactionCategory */
  category: string;
  /** NEW | CATEGORIZED | MATCHED | EXCLUDED */
  status: string;
  amount: number;
  /** The account's currency: a transaction has none of its own. */
  currency: string;
  contact_id: string | null;
  matched_document_id: string | null;
  /** INVOICE | EXPENSE */
  matched_kind: string | null;
  import_batch: string | null;
  /** Lower-cased haystack: counterparty, description, reference, amount, category label. */
  search_text: string;
}

export interface DB {
  invoice_index: InvoiceRow;
  account_index: AccountRow;
  transaction_index: TransactionRow;
}
