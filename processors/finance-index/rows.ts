// Turns invoice, bank-account, expense-report and contact documents into
// their index rows. Pure,
// shared by the processor (which runs in the switchboard and in a tab's
// in-process reactor) and by its tests. Rows come only off an operation's
// resulting state: the whole document state, so the row is exact and an
// account's transaction rows are its whole transaction list.
import type {
  BankAccountState,
  Transaction,
  TransactionCategory,
} from "document-models/bank-account";
import {
  computeTotals,
  findRate,
  round2,
  type InvoiceState,
} from "document-models/invoice";
import type { ContactState } from "document-models/contact";
import type { ExpenseReportState } from "document-models/expense-report";
import type { InvoiceState as InvoiceStateV1 } from "document-models/invoice/v1";
import { upgradeGlobal } from "../../document-models/invoice/upgrades/v2.js";
import type {
  AccountRow,
  ContactRow,
  ExpenseItemRow,
  ExpenseRow,
  InvoiceRow,
  TransactionRow,
} from "./schema.js";

type Json = Record<string, unknown>;

/**
 * The currency the books are kept in: what the boards add up in. The same
 * constant as `BOOK_CURRENCY` in editors/sektar/kit/format.ts (that module
 * pulls in React, so a processor does not import it; rows.spec.ts checks the
 * two agree).
 */
export const BOOK_CURRENCY = "EUR";

/**
 * The category labels the Transactions search matches, as
 * editors/sektar/kit/format.ts `CATEGORY` names them (rows.spec.ts checks
 * the two agree).
 */
export const CATEGORY_LABEL: Record<TransactionCategory, string> = {
  UNCATEGORIZED: "Uncategorised",
  SALES: "Sales",
  SUPPLIES: "Supplies",
  PAYROLL: "Payroll",
  RENT: "Rent",
  SOFTWARE: "Software",
  TRAVEL: "Travel",
  MARKETING: "Marketing",
  TAX: "Tax",
  BANK_FEES: "Fees",
  TRANSFER: "Transfer",
  OTHER: "Other",
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

const haystack = (...parts: (string | number | null | undefined)[]): string =>
  parts
    .filter((p) => p !== null && p !== undefined && p !== "")
    .map((p) => String(p))
    .join(" ")
    .toLowerCase();

/** The scope's state out of an operation's `resultingState`, if it carries one. */
export function parseState(json: string | undefined): Json | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object") {
      // resultingState is the scope's state; some transports wrap it per scope.
      const obj = parsed as Json;
      return obj.global && typeof obj.global === "object"
        ? (obj.global as Json)
        : obj;
    }
  } catch {
    // not JSON: the operation is treated as one without a state
  }
  return null;
}

/* ---------------------------------------------------------------- invoices */

/**
 * An invoice's global state in the current (v2) shape. A v1 state (one
 * `counterparty`, lines without a VAT category) goes through the model's own
 * upgrade; anything else that is not an invoice is null.
 */
export function invoiceState(state: Json): InvoiceState | null {
  if (!Array.isArray(state.lines) || !Array.isArray(state.payments)) return null;
  if (state.buyer && typeof state.buyer === "object") {
    return state as unknown as InvoiceState;
  }
  if (state.counterparty && typeof state.counterparty === "object") {
    return upgradeGlobal(state as unknown as InvoiceStateV1);
  }
  return null;
}

/** Digit runs zero-padded, lower-cased: plain string order that sorts as `localeCompare(…, { numeric: true })`. */
export function numberSortKey(number: string): string {
  return number.toLowerCase().replace(/\d+/g, (d) => d.padStart(16, "0"));
}

export interface InvoiceAmounts {
  gross: number;
  outstanding: number;
  bookGross: number;
  bookOutstanding: number;
  bookRateKnown: boolean;
}

/**
 * The amounts the boards show: `computeTotals` (what the reducer and the
 * editor use), outstanding never below zero as `invoiceTotals` has it, and
 * the book amounts at the invoice's own rate as `bookTotals` converts them.
 * Without a rate the book amounts stay unconverted, as `bookTotals` leaves
 * them: close enough for a board, never for the books.
 */
export function invoiceAmounts(state: InvoiceState): InvoiceAmounts {
  const t = computeTotals(state);
  const gross = t.gross;
  const outstanding = round2(Math.max(0, t.due));
  if (state.currency === BOOK_CURRENCY) {
    return { gross, outstanding, bookGross: gross, bookOutstanding: outstanding, bookRateKnown: true };
  }
  const rate = findRate(state.exchangeRates ?? [], state.currency, BOOK_CURRENCY);
  if (rate === null) {
    return { gross, outstanding, bookGross: gross, bookOutstanding: outstanding, bookRateKnown: false };
  }
  return {
    gross,
    outstanding,
    bookGross: round2(gross * rate),
    bookOutstanding: round2(outstanding * rate),
    bookRateKnown: true,
  };
}

/**
 * Our side of an invoice as a new invoice copies it: the party without its
 * contact link, as JSON; null while it has no name (a new invoice skips
 * such invoices).
 */
export function ourPartyOf(state: InvoiceState): string | null {
  const ours = state.direction === "OUTGOING" ? state.seller : state.buyer;
  if (!ours?.name) return null;
  const { contactId: _contactId, ...rest } = ours;
  return JSON.stringify(rest);
}

/**
 * The row for an invoice from its global state. `createdAt` is when the
 * document was made (the drafts' last fallback in the list order); `at` is
 * the operation's time.
 */
export function invoiceRow(
  documentId: string,
  state: InvoiceState,
  createdAt: string,
  at: string,
): InvoiceRow {
  const party = state.direction === "OUTGOING" ? state.buyer : state.seller;
  const amounts = invoiceAmounts(state);
  const number = str(state.number);
  const deliveredAt = str(state.deliveredAt);
  const periodStart = str(state.period?.start);
  const periodEnd = str(state.period?.end);
  const issuedCopy = (state.attachments ?? []).find((a) => a.role === "ISSUED_COPY");
  const lines = state.lines;
  return {
    document_id: documentId,
    direction: state.direction,
    kind: state.kind ?? "INVOICE",
    status: state.status,
    number,
    is_draft: !number,
    list_key: number
      ? numberSortKey(number)
      : (deliveredAt ?? periodEnd ?? periodStart ?? createdAt),
    counterparty_name: str(party?.name),
    counterparty_contact_id: str(party?.contactId),
    subject: str(state.subject),
    first_line: str(lines[0]?.description),
    currency: state.currency,
    issued_at: str(state.issuedAt),
    due_at: str(state.dueAt),
    delivered_at: deliveredAt,
    period_start: periodStart,
    period_end: periodEnd,
    created_at: createdAt,
    gross: amounts.gross,
    outstanding: amounts.outstanding,
    book_gross: amounts.bookGross,
    book_outstanding: amounts.bookOutstanding,
    book_rate_known: amounts.bookRateKnown,
    issued_copy_id: issuedCopy?.id ?? null,
    issued_copy_ref: issuedCopy?.ref ?? null,
    line_count: lines.length,
    lines_missing_attachments: lines.filter((l) => (l.attachments ?? []).length === 0).length,
    last_paid_at: str(state.payments.at(-1)?.paidAt),
    our_party: ourPartyOf(state),
    search_text: haystack(
      number,
      party?.name,
      state.subject,
      state.references?.buyerReference,
      amounts.gross,
    ),
    updated_at: at,
  };
}

/* ---------------------------------------------------------------- accounts */

/** A bank account's global state, or null when the state is not one. */
export function accountState(state: Json): BankAccountState | null {
  if (!Array.isArray(state.transactions)) return null;
  return state as unknown as BankAccountState;
}

/** One transaction's row. */
export function transactionRow(
  accountId: string,
  currency: string,
  tx: Transaction,
): TransactionRow {
  const category = tx.category ?? "UNCATEGORIZED";
  return {
    id: tx.id,
    account_id: accountId,
    booked_at: tx.bookedAt,
    counterparty: tx.counterparty ?? "",
    description: tx.description ?? null,
    reference: tx.reference ?? null,
    category,
    status: tx.status ?? "NEW",
    amount: num(tx.amount),
    currency,
    contact_id: tx.contactId ?? null,
    matched_document_id: tx.matchedDocumentId ?? null,
    matched_kind: tx.matchedKind ?? null,
    import_batch: tx.importBatch ?? null,
    search_text: haystack(
      tx.counterparty,
      tx.description,
      tx.reference,
      tx.amount,
      CATEGORY_LABEL[category] ?? category,
    ),
  };
}

/** The account's row and its transactions' rows, from its global state. */
export function accountRows(
  documentId: string,
  state: BankAccountState,
  at: string,
): { account: AccountRow; transactions: TransactionRow[] } {
  const currency = state.currency;
  const transactions = state.transactions
    .filter((tx) => typeof tx?.id === "string" && tx.id !== "")
    .map((tx) => transactionRow(documentId, currency, tx));
  // `accountBalance`: the opening balance plus every booked transaction not
  // excluded (pending ones are not booked yet), added in the document's order.
  const balance = state.transactions
    .filter((t) => t.status !== "EXCLUDED" && t.status !== "PENDING")
    .reduce((sum, t) => sum + num(t.amount), num(state.openingBalance));
  const iban = str(state.iban)?.replace(/\s+/g, "") ?? null;
  return {
    account: {
      document_id: documentId,
      name: str(state.name),
      kind: state.kind ?? "CURRENT",
      institution: str(state.institution),
      iban_last4: iban ? iban.slice(-4) : null,
      currency,
      opening_balance: num(state.openingBalance),
      balance,
      tx_count: transactions.length,
      new_count: transactions.filter((t) => t.status === "NEW").length,
      last_imported_at: str(state.lastImportedAt),
      updated_at: at,
    },
    transactions,
  };
}

/** Same stored content: an unchanged transaction is not rewritten. */
export function sameTransaction(a: TransactionRow, b: TransactionRow): boolean {
  return (
    a.id === b.id &&
    a.account_id === b.account_id &&
    a.booked_at === b.booked_at &&
    a.counterparty === b.counterparty &&
    a.description === b.description &&
    a.reference === b.reference &&
    a.category === b.category &&
    a.status === b.status &&
    Number(a.amount) === Number(b.amount) &&
    a.currency === b.currency &&
    a.contact_id === b.contact_id &&
    a.matched_document_id === b.matched_document_id &&
    a.matched_kind === b.matched_kind &&
    a.import_batch === b.import_batch &&
    a.search_text === b.search_text
  );
}

/**
 * What it takes to bring an account's stored transaction rows to its state:
 * the ids to delete (no longer in the account) and the rows to write (new or
 * changed). Rows of the account that are unchanged are left alone.
 */
export function diffTransactions(
  stored: readonly TransactionRow[],
  truth: readonly TransactionRow[],
): { deletes: string[]; upserts: TransactionRow[] } {
  const want = new Map(truth.map((r) => [r.id, r]));
  const have = new Map(stored.map((r) => [r.id, r]));
  const deletes = [...have.keys()].filter((id) => !want.has(id));
  const upserts: TransactionRow[] = [];
  for (const [id, row] of want) {
    const current = have.get(id);
    if (!current || !sameTransaction(current, row)) upserts.push(row);
  }
  return { deletes, upserts };
}

/* ---------------------------------------------------------------- expenses */

/** An expense report's global state, or null when the state is not one. */
export function expenseState(state: Json): ExpenseReportState | null {
  if (!Array.isArray(state.items)) return null;
  if (!state.submitter || typeof state.submitter !== "object") return null;
  if (typeof state.status !== "string") return null;
  return state as unknown as ExpenseReportState;
}

/**
 * The claim's row and its receipts' rows from its global state. `createdAt`
 * is when the document was made (the card's date without receipts); `at`
 * is the operation's time.
 */
export function expenseRows(
  documentId: string,
  state: ExpenseReportState,
  createdAt: string,
  at: string,
): { report: ExpenseRow; items: ExpenseItemRow[] } {
  const items = state.items.filter((i) => typeof i?.id === "string" && i.id !== "");
  const categories = [...new Set(items.map((i) => i.category ?? "UNCATEGORIZED"))];
  return {
    report: {
      document_id: documentId,
      title: str(state.title),
      submitter_name: str(state.submitter?.name),
      submitter_email: str(state.submitter?.email),
      status: state.status,
      currency: state.currency || BOOK_CURRENCY,
      total: round2(items.reduce((sum, i) => sum + num(i.amount), 0)),
      reimbursable: round2(
        items
          .filter((i) => i.paidWith === "PERSONAL" || i.paidWith === "CASH")
          .reduce((sum, i) => sum + num(i.amount), 0),
      ),
      vat_total: round2(items.reduce((sum, i) => sum + num(i.vatAmount), 0)),
      item_count: items.length,
      categories: categories.join(","),
      first_spent_at: str(items[0]?.spentAt),
      submitted_at: str(state.submittedAt),
      decided_at: str(state.decidedAt),
      reimbursed_at: str(state.reimbursedAt),
      created_at: createdAt,
      search_text: haystack(
        state.title,
        state.submitter?.name,
        ...items.map((i) => i.merchant),
      ),
      updated_at: at,
    },
    items: items.map((i) => ({
      report_id: documentId,
      id: i.id,
      spent_at: i.spentAt,
      amount: num(i.amount),
      category: i.category ?? "UNCATEGORIZED",
      paid_with: i.paidWith ?? "PERSONAL",
    })),
  };
}

/* ---------------------------------------------------------------- contacts */

/** A contact's global state, or null when the state is not one. */
export function contactState(state: Json): ContactState | null {
  if (!Array.isArray(state.tags) || !Array.isArray(state.people)) return null;
  if (!state.address || typeof state.address !== "object") return null;
  return state as unknown as ContactState;
}

/** The row for a contact from its global state; `at` is the operation's time. */
export function contactRow(
  documentId: string,
  state: ContactState,
  at: string,
): ContactRow {
  const tags = state.tags.filter((t): t is string => typeof t === "string");
  return {
    document_id: documentId,
    name: str(state.name),
    kind: state.kind ?? "SUPPLIER",
    status: state.status ?? "ACTIVE",
    email: str(state.email),
    phone: str(state.phone),
    website: str(state.website),
    vat_id: str(state.vatId),
    registration_number: str(state.registrationNumber),
    street: str(state.address?.street),
    postal_code: str(state.address?.postalCode),
    city: str(state.address?.city),
    country: str(state.address?.country),
    payment_terms_days:
      typeof state.paymentTermsDays === "number" ? state.paymentTermsDays : 30,
    default_category: state.defaultCategory ?? "UNCATEGORIZED",
    tags: JSON.stringify(tags),
    search_text: haystack(state.name, state.email, state.address?.city, ...tags),
    updated_at: at,
  };
}
