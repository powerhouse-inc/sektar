// Turns invoice and bank-account documents into their index rows. Pure,
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
import type { InvoiceState as InvoiceStateV1 } from "document-models/invoice/v1";
import { upgradeGlobal } from "../../document-models/invoice/upgrades/v2.js";
import type { AccountRow, InvoiceRow, TransactionRow } from "./schema.js";

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
  // `accountBalance`: the opening balance plus every transaction not excluded,
  // added in the document's order.
  const balance = state.transactions
    .filter((t) => t.status !== "EXCLUDED")
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
