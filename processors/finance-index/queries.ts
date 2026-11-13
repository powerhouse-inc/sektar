// The questions the finance boards ask, as queries over the index. Shared by
// the subgraph (the switchboard answers Connect over GraphQL) and by a tab
// whose own reactor runs the processor (standalone Connect, a live query), so
// the two never disagree on what "overdue" or "to review" means.
// The declarations name kysely's builder types (these queries return them):
// importing the package lets tsc refer to "kysely", not to a path into .pnpm.
import type {} from "kysely";
import type { IRelationalDb } from "@powerhousedao/reactor-browser";
import type {
  AccountRow,
  ContactRow,
  DB,
  ExpenseRow,
  InvoiceRow,
  TransactionRow,
} from "./schema.js";
import {
  DEFAULT_BOOK_CURRENCY,
  dayOf,
  Fx,
  type FxRate,
  parseOwnRates,
  roundMoney,
} from "./fx.js";

/** What both a namespaced query builder and a Kysely instance offer. */
export type FinanceQueryBuilder = Pick<IRelationalDb<DB>, "selectFrom">;

/** Rows per page by default; the subgraph caps a request at FINANCE_PAGE_MAX. */
export const FINANCE_PAGE = 100;
export const FINANCE_PAGE_MAX = 500;

/** The Invoices workspace's status menu. */
export type InvoiceView = "all" | "draft" | "open" | "overdue" | "settled";
export const INVOICE_VIEWS: readonly InvoiceView[] = [
  "all",
  "draft",
  "open",
  "overdue",
  "settled",
];

export type TransactionStatusFilter =
  | "PENDING"
  | "NEW"
  | "CATEGORIZED"
  | "MATCHED"
  | "EXCLUDED";

/** The words of a search, lower-cased, at most `max` of them. */
export function searchWords(
  query: string | null | undefined,
  max = 6,
): string[] {
  return (query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, max);
}

/* -------------------------------------------------------- the books' rates */

/**
 * Narrows a query to the rows the caller may see, given the column that
 * names the row's document (`document_id` for invoices and accounts,
 * `account_id` for transactions). The switchboard's subgraph passes the
 * host's readable-documents filter; the browser, reading its own reactor,
 * passes nothing.
 */
export type QueryRestriction = <Q extends { where(...args: any[]): Q }>(
  q: Q,
  documentColumn: string,
) => Q;

const NO_RESTRICTION: QueryRestriction = (q) => q;

/** The books' settings as a page reads them. */
export interface FinanceSettings {
  /** The settings document; null while the books have none (they are in euros). */
  documentId: string | null;
  /** The main currency: what every total is shown in. */
  bookCurrency: string;
}

/** The books' settings: the oldest settings document's, euros without one. */
export async function loadSettings(
  db: FinanceQueryBuilder,
  restrict: QueryRestriction = NO_RESTRICTION,
): Promise<FinanceSettings> {
  const row = await restrict(
    db
      .selectFrom("settings_index")
      .select(["document_id", "base_currency"])
      .orderBy("created_at", "asc")
      .orderBy("document_id", "asc")
      .limit(1),
    "document_id",
  ).executeTakeFirst();
  return {
    documentId: row?.document_id ?? null,
    bookCurrency: row?.base_currency || DEFAULT_BOOK_CURRENCY,
  };
}

/** A currency pair as the settings page and the rate sync read it. */
export interface CurrencyPairRow {
  id: string;
  base: string;
  quote: string;
  rateCount: number;
  /** "YYYY-MM-DD"; null while the pair holds no rate. */
  firstDay: string | null;
  lastDay: string | null;
  lastRate: number | null;
  lastSource: string | null;
  lastFetchedAt: string | null;
}

/**
 * The named pairs, one per pair of currencies: with two documents for one
 * pair, the oldest is the pair's and the other is ignored, whole.
 */
export async function loadPairs(
  db: FinanceQueryBuilder,
  restrict: QueryRestriction = NO_RESTRICTION,
): Promise<CurrencyPairRow[]> {
  const rows = await restrict(
    db
      .selectFrom("pair_index")
      .selectAll()
      .where("base", "is not", null)
      .where("quote", "is not", null)
      .orderBy("created_at", "asc")
      .orderBy("document_id", "asc"),
    "document_id",
  ).execute();
  const seen = new Set<string>();
  const pairs: CurrencyPairRow[] = [];
  for (const r of rows) {
    if (!r.base || !r.quote) continue;
    const key = `${r.base}/${r.quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({
      id: r.document_id,
      base: r.base,
      quote: r.quote,
      rateCount: Number(r.rate_count),
      firstDay: r.first_day,
      lastDay: r.last_day,
      lastRate: r.last_rate === null ? null : Number(r.last_rate),
      lastSource: r.last_source,
      lastFetchedAt: r.last_fetched_at,
    });
  }
  return pairs.sort(
    (x, y) => x.base.localeCompare(y.base) || x.quote.localeCompare(y.quote),
  );
}

/** A currency the books hold amounts in, and the first day they need a rate for. */
export interface CurrencyInUse {
  currency: string;
  /** "YYYY-MM-DD": the earliest booking, issue or receipt in it; null when undated. */
  since: string | null;
}

/**
 * Every currency the books hold amounts in (accounts, invoices, claims),
 * with the earliest day each needs a rate for: what the rate sync makes
 * pairs for and how far back it fetches.
 */
export async function loadCurrenciesInUse(
  db: FinanceQueryBuilder,
  restrict: QueryRestriction = NO_RESTRICTION,
): Promise<CurrencyInUse[]> {
  const [accounts, transactions, invoices, claims] = await Promise.all([
    restrict(
      db.selectFrom("account_index").select("currency").distinct(),
      "document_id",
    ).execute(),
    restrict(
      db
        .selectFrom("transaction_index")
        .select("currency")
        .select((eb) => eb.fn.min("booked_at").as("since"))
        .groupBy("currency"),
      "account_id",
    ).execute(),
    restrict(
      db
        .selectFrom("invoice_index")
        .select("currency")
        .select((eb) => eb.fn.min("issued_at").as("since"))
        .groupBy("currency"),
      "document_id",
    ).execute(),
    restrict(
      db
        .selectFrom("expense_index")
        .select("currency")
        .select((eb) => eb.fn.min("first_spent_at").as("since"))
        .groupBy("currency"),
      "document_id",
    ).execute(),
  ]);
  const since = new Map<string, string | null>();
  const note = (currency: string, day: string | null) => {
    if (!currency) return;
    const known = since.get(currency);
    if (known === undefined) since.set(currency, day);
    else if (day && (!known || day < known)) since.set(currency, day);
  };
  for (const a of accounts) note(a.currency, null);
  for (const r of [...transactions, ...invoices, ...claims]) {
    note(r.currency, dayOf(r.since));
  }
  return [...since]
    .map(([currency, day]) => ({ currency, since: day }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

/**
 * What a total converts with: the main currency and every rate quoted in it.
 * Only pairs that point at the main currency are read (no inverse, no chain
 * through a third currency), one document per pair (`loadPairs`).
 */
export async function loadFx(
  db: FinanceQueryBuilder,
  restrict: QueryRestriction = NO_RESTRICTION,
): Promise<Fx> {
  const [{ bookCurrency }, pairs] = await Promise.all([
    loadSettings(db, restrict),
    loadPairs(db, restrict),
  ]);
  const ids = pairs.filter((p) => p.quote === bookCurrency).map((p) => p.id);
  if (ids.length === 0) return new Fx(bookCurrency, []);
  const rows = await restrict(
    db
      .selectFrom("rate_index")
      .select(["base", "day", "rate"])
      .where("pair_id", "in", ids)
      .where("quote", "=", bookCurrency),
    "pair_id",
  ).execute();
  return new Fx(
    bookCurrency,
    rows.map((r) => ({ base: r.base, day: r.day, rate: Number(r.rate) })),
  );
}

/** The rates a page outside the finance index converts with. */
export interface FinanceClosingRates {
  /** The main currency of the books. */
  bookCurrency: string;
  /**
   * Per currency quoted in it, the rate that closed each year (the latest
   * one for the year still running): `new Fx(bookCurrency, rates)` answers
   * a year's closing rate for `<year>-12-31`.
   */
  rates: FxRate[];
}

/**
 * The closing rate of every year, per currency: what a total that is not the
 * finance index's own (Business Travel's spend per year) converts with. A
 * handful of rows per currency, where every day's rate would be thousands.
 */
export async function loadClosingRates(
  db: FinanceQueryBuilder,
  restrict: QueryRestriction = NO_RESTRICTION,
): Promise<FinanceClosingRates> {
  const [{ bookCurrency }, pairs] = await Promise.all([
    loadSettings(db, restrict),
    loadPairs(db, restrict),
  ]);
  const ids = pairs.filter((p) => p.quote === bookCurrency).map((p) => p.id);
  if (ids.length === 0) return { bookCurrency, rates: [] };
  const rows = await restrict(
    db
      .selectFrom("rate_index")
      .select(["base", "day", "rate"])
      .where("pair_id", "in", ids)
      .where("quote", "=", bookCurrency)
      .orderBy("day", "asc"),
    "pair_id",
  ).execute();
  // ascending by day: the last row of a currency's year is its closing rate
  const closing = new Map<string, FxRate>();
  for (const r of rows) {
    closing.set(`${r.base}:${r.day.slice(0, 4)}`, {
      base: r.base,
      day: r.day,
      rate: Number(r.rate),
    });
  }
  return {
    bookCurrency,
    rates: [...closing.values()].sort(
      (a, b) => a.base.localeCompare(b.base) || a.day.localeCompare(b.day),
    ),
  };
}

/** LIKE's own wildcards are dropped from a word: a search is for text, not patterns. */
function likeWord(word: string): string {
  return `%${word.replace(/[%_\\]/g, "")}%`;
}

/** `now` as the ISO instant the date columns are compared with. */
export function isoNow(now: number | string | null | undefined): string {
  if (typeof now === "number" && Number.isFinite(now))
    return new Date(now).toISOString();
  if (typeof now === "string" && now) {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

/* ---------------------------------------------------------------- invoices */

export interface InvoiceFilter {
  /** OUTGOING | INCOMING; both when absent. */
  direction?: string | null;
  view?: InvoiceView;
  /** Lower-cased words, each of which must appear in the row's search text. */
  words?: readonly string[];
  /** ISO instant: an OPEN invoice due before it is overdue. */
  now: string;
  /** Only the invoices whose other party is this contact. */
  contactId?: string | null;
}

function invoicesFiltered(db: FinanceQueryBuilder, f: InvoiceFilter) {
  let q = db.selectFrom("invoice_index");
  if (f.direction) q = q.where("direction", "=", f.direction);
  if (f.contactId) q = q.where("counterparty_contact_id", "=", f.contactId);
  switch (f.view ?? "all") {
    case "draft":
      q = q.where("status", "=", "DRAFT");
      break;
    case "open":
      // `isOverdue` is OPEN with a due date before now; open is OPEN without.
      q = q
        .where("status", "=", "OPEN")
        .where((eb) =>
          eb.or([eb("due_at", "is", null), eb("due_at", ">=", f.now)]),
        );
      break;
    case "overdue":
      q = q
        .where("status", "=", "OPEN")
        .where("due_at", "is not", null)
        .where("due_at", "<", f.now);
      break;
    case "settled":
      q = q.where("status", "in", ["PAID", "VOID"]);
      break;
    default:
      break;
  }
  for (const word of f.words ?? []) {
    if (word) q = q.where("search_text", "like", likeWord(word));
  }
  return q;
}

/**
 * One page of invoices in the workspace's `byListOrder`: drafts first, latest
 * first by what they cover; then the issued by number, highest first. Asks
 * for one row more than the page so the caller knows whether another exists.
 */
export function invoicesQuery(
  db: FinanceQueryBuilder,
  f: InvoiceFilter,
  page: { offset?: number | null; limit: number },
) {
  const ordered = invoicesFiltered(db, f)
    .selectAll()
    .orderBy("is_draft", "desc")
    .orderBy("list_key", "desc")
    .orderBy("document_id", "desc")
    .limit(page.limit + 1);
  return page.offset ? ordered.offset(page.offset) : ordered;
}

/** How many invoices the filters match. */
export function invoiceCountQuery(db: FinanceQueryBuilder, f: InvoiceFilter) {
  return invoicesFiltered(db, f).select((eb) =>
    eb.fn.countAll<number>().as("n"),
  );
}

/** Invoices per direction and per view, in one pass. */
export function invoiceViewCountsQuery(db: FinanceQueryBuilder, now: string) {
  return db
    .selectFrom("invoice_index")
    .select("direction")
    .select((eb) => [
      eb.fn.countAll<number>().as("all"),
      eb.fn.countAll<number>().filterWhere("status", "=", "DRAFT").as("draft"),
      eb.fn
        .countAll<number>()
        .filterWhere((w) =>
          w.and([
            w("status", "=", "OPEN"),
            w.or([w("due_at", "is", null), w("due_at", ">=", now)]),
          ]),
        )
        .as("open"),
      eb.fn
        .countAll<number>()
        .filterWhere((w) =>
          w.and([
            w("status", "=", "OPEN"),
            w("due_at", "is not", null),
            w("due_at", "<", now),
          ]),
        )
        .as("overdue"),
      eb.fn
        .countAll<number>()
        .filterWhere("status", "in", ["PAID", "VOID"])
        .as("settled"),
    ])
    .groupBy("direction");
}

export interface InvoiceViewCountRow {
  direction: string;
  all: number | string;
  draft: number | string;
  open: number | string;
  overdue: number | string;
  settled: number | string;
}

export interface ViewCount {
  direction: string;
  view: InvoiceView;
  count: number;
}

export interface InvoiceCounts {
  outgoing: number;
  incoming: number;
  byView: ViewCount[];
}

/** The per-direction counts folded into what the workspace shows. */
export function toInvoiceCounts(
  rows: readonly InvoiceViewCountRow[],
): InvoiceCounts {
  const byView: ViewCount[] = [];
  let outgoing = 0;
  let incoming = 0;
  for (const direction of ["OUTGOING", "INCOMING"]) {
    const r = rows.find((x) => x.direction === direction);
    for (const view of INVOICE_VIEWS) {
      byView.push({ direction, view, count: Number(r?.[view] ?? 0) });
    }
    const all = Number(r?.all ?? 0);
    if (direction === "OUTGOING") outgoing = all;
    else incoming = all;
  }
  return { outgoing, incoming, byView };
}

/** An invoice as the list shows it: the row, in the subgraph's vocabulary. */
export interface InvoiceListRow {
  id: string;
  direction: string;
  kind: string;
  status: string;
  number: string | null;
  counterpartyName: string | null;
  counterpartyContactId: string | null;
  subject: string | null;
  firstLine: string | null;
  currency: string;
  issuedAt: string | null;
  dueAt: string | null;
  deliveredAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  /** In the invoice's own currency. */
  gross: number;
  outstanding: number;
  /**
   * The same in the main currency of the books, converted on reading: at the
   * invoice's own rate, else at the books' latest. Unconverted when
   * `bookRateKnown` is false.
   */
  bookGross: number;
  bookOutstanding: number;
  bookRateKnown: boolean;
  /** OPEN with a due date before `now`. */
  overdue: boolean;
  issuedCopyId: string | null;
  issuedCopyRef: string | null;
  lineCount: number;
  linesMissingAttachments: number;
  lastPaidAt: string | null;
  updatedAt: string;
}

export interface InvoicePageResult {
  items: InvoiceListRow[];
  total: number;
  hasMore: boolean;
}

export function toInvoiceRow(r: InvoiceRow, now: string, fx: Fx): InvoiceListRow {
  const own = parseOwnRates(r.rates);
  const gross = Number(r.gross);
  const outstanding = Number(r.outstanding);
  const bookGross = fx.convertInvoice(gross, r.currency, own);
  const bookOutstanding = fx.convertInvoice(outstanding, r.currency, own);
  return {
    id: r.document_id,
    direction: r.direction,
    kind: r.kind,
    status: r.status,
    number: r.number,
    counterpartyName: r.counterparty_name,
    counterpartyContactId: r.counterparty_contact_id,
    subject: r.subject,
    firstLine: r.first_line,
    currency: r.currency,
    issuedAt: r.issued_at,
    dueAt: r.due_at,
    deliveredAt: r.delivered_at,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    createdAt: r.created_at,
    gross,
    outstanding,
    bookGross: bookGross === null ? gross : roundMoney(bookGross),
    bookOutstanding:
      bookOutstanding === null ? outstanding : roundMoney(bookOutstanding),
    bookRateKnown: bookGross !== null,
    overdue: r.status === "OPEN" && !!r.due_at && r.due_at < now,
    issuedCopyId: r.issued_copy_id,
    issuedCopyRef: r.issued_copy_ref,
    lineCount: Number(r.line_count),
    linesMissingAttachments: Number(r.lines_missing_attachments),
    lastPaidAt: r.last_paid_at,
    updatedAt: r.updated_at,
  };
}

/* ---------------------------------------------------------------- accounts */

/**
 * Every account, by name, with the date of its latest transaction. Small: one
 * row per account document; the date is the newest booking among its rows in
 * transaction_index, read through the (account_id, booked_at desc) index.
 */
export function accountsQuery(db: FinanceQueryBuilder) {
  return db
    .selectFrom("account_index")
    .selectAll("account_index")
    .select((eb) =>
      eb
        .selectFrom("transaction_index")
        .whereRef("transaction_index.account_id", "=", "account_index.document_id")
        .select((t) => t.fn.max("transaction_index.booked_at").as("booked"))
        .as("last_booked_at"),
    )
    .orderBy("account_index.name", "asc")
    .orderBy("account_index.document_id", "asc");
}

export interface AccountListRow {
  id: string;
  name: string | null;
  kind: string;
  institution: string | null;
  ibanLast4: string | null;
  currency: string;
  openingBalance: number;
  balance: number;
  txCount: number;
  newCount: number;
  lastImportedAt: string | null;
  /** When its latest transaction was booked; null without transactions. */
  lastBookedAt: string | null;
  updatedAt: string;
}

export function toAccountRow(
  r: AccountRow & { last_booked_at?: string | null },
): AccountListRow {
  return {
    id: r.document_id,
    name: r.name,
    kind: r.kind,
    institution: r.institution,
    ibanLast4: r.iban_last4,
    currency: r.currency,
    openingBalance: Number(r.opening_balance),
    balance: Number(r.balance),
    txCount: Number(r.tx_count),
    newCount: Number(r.new_count),
    lastImportedAt: r.last_imported_at,
    lastBookedAt: r.last_booked_at ?? null,
    updatedAt: r.updated_at,
  };
}

/* ------------------------------------------------------------ transactions */

export interface TransactionFilter {
  /** An account document id; every account when absent. */
  accountId?: string | null;
  status?: string | null;
  category?: string | null;
  /** Lower-cased words over counterparty, description, reference, amount, category label. */
  words?: readonly string[];
  /** Only the transactions linked to this contact. */
  contactId?: string | null;
}

function transactionsFiltered(db: FinanceQueryBuilder, f: TransactionFilter) {
  let q = db.selectFrom("transaction_index");
  if (f.accountId) q = q.where("account_id", "=", f.accountId);
  if (f.contactId) q = q.where("contact_id", "=", f.contactId);
  if (f.status) q = q.where("status", "=", f.status);
  if (f.category) q = q.where("category", "=", f.category);
  for (const word of f.words ?? []) {
    if (word) q = q.where("search_text", "like", likeWord(word));
  }
  return q;
}

/** One page of transactions, latest booked first. One row more than the page. */
export function transactionsQuery(
  db: FinanceQueryBuilder,
  f: TransactionFilter,
  page: { offset?: number | null; limit: number },
) {
  const ordered = transactionsFiltered(db, f)
    .selectAll()
    .orderBy("booked_at", "desc")
    .orderBy("id", "desc")
    .limit(page.limit + 1);
  return page.offset ? ordered.offset(page.offset) : ordered;
}

/** How many transactions the filters match. */
export function transactionCountQuery(
  db: FinanceQueryBuilder,
  f: TransactionFilter,
) {
  return transactionsFiltered(db, f).select((eb) =>
    eb.fn.countAll<number>().as("n"),
  );
}

/** The status menu's counts, for one account or all. */
export function transactionCountsQuery(
  db: FinanceQueryBuilder,
  accountId?: string | null,
) {
  let q = db.selectFrom("transaction_index");
  if (accountId) q = q.where("account_id", "=", accountId);
  return q.select((eb) => [
    eb.fn.countAll<number>().as("all"),
    eb.fn.countAll<number>().filterWhere("status", "=", "NEW").as("new"),
    eb.fn
      .countAll<number>()
      .filterWhere("status", "=", "CATEGORIZED")
      .as("categorised"),
    eb.fn
      .countAll<number>()
      .filterWhere("status", "=", "MATCHED")
      .as("matched"),
    eb.fn
      .countAll<number>()
      .filterWhere("status", "=", "EXCLUDED")
      .as("excluded"),
    eb.fn
      .countAll<number>()
      .filterWhere("status", "=", "PENDING")
      .as("pending"),
  ]);
}

export interface TransactionCounts {
  all: number;
  new: number;
  categorised: number;
  matched: number;
  excluded: number;
  /** Reported by the bank, not booked yet. */
  pending: number;
}

export function toTransactionCounts(
  r:
    | {
        all: number | string;
        new: number | string;
        categorised: number | string;
        matched: number | string;
        excluded: number | string;
        pending?: number | string;
      }
    | undefined,
): TransactionCounts {
  return {
    all: Number(r?.all ?? 0),
    new: Number(r?.new ?? 0),
    categorised: Number(r?.categorised ?? 0),
    matched: Number(r?.matched ?? 0),
    excluded: Number(r?.excluded ?? 0),
    pending: Number(r?.pending ?? 0),
  };
}

export interface TransactionListRow {
  id: string;
  accountId: string;
  bookedAt: string;
  counterparty: string;
  description: string | null;
  reference: string | null;
  category: string;
  status: string;
  amount: number;
  currency: string;
  contactId: string | null;
  matchedDocumentId: string | null;
  matchedKind: string | null;
  importBatch: string | null;
}

export interface TransactionPageResult {
  items: TransactionListRow[];
  total: number;
  hasMore: boolean;
}

export function toTransactionRow(r: TransactionRow): TransactionListRow {
  return {
    id: r.id,
    accountId: r.account_id,
    bookedAt: r.booked_at,
    counterparty: r.counterparty,
    description: r.description,
    reference: r.reference,
    category: r.category,
    status: r.status,
    amount: Number(r.amount),
    currency: r.currency,
    contactId: r.contact_id,
    matchedDocumentId: r.matched_document_id,
    matchedKind: r.matched_kind,
    importBatch: r.import_batch,
  };
}

/* --------------------------------------------------------------- dashboard */

const DAY_MS = 86_400_000;

/** The six months the cash-flow bars cover, oldest first, as "YYYY-MM": the dashboard's own bucketing. */
export function dashboardMonths(nowMs: number): string[] {
  const keys: string[] = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(nowMs);
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - m);
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

/** The month after "YYYY-MM", as "YYYY-MM". */
function nextMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/**
 * Every query the Finances dashboard needs, as builders: run them as one
 * round of parallel reads (`loadDashboard`) or each as a live query, and
 * fold the results with `toDashboardStats`.
 */
export function dashboardQueries(db: FinanceQueryBuilder, nowMs: number) {
  const now = new Date(nowMs).toISOString();
  const months = dashboardMonths(nowMs);
  const since = new Date(nowMs - 90 * DAY_MS).toISOString();
  return {
    /** Cash (every account but cards) and card positions, per currency. */
    positions: db
      .selectFrom("account_index")
      .select("currency")
      .select((eb) => [
        eb.fn
          .sum<number>("balance")
          .filterWhere("kind", "!=", "CREDIT_CARD")
          .as("cash"),
        eb.fn
          .sum<number>("balance")
          .filterWhere("kind", "=", "CREDIT_CARD")
          .as("card"),
      ])
      .groupBy("currency"),
    /** What the OPEN invoices still owe, each in its own currency with its own rates. */
    open: db
      .selectFrom("invoice_index")
      .select(["direction", "currency", "outstanding", "rates"])
      .where("status", "=", "OPEN"),
    /** The readiness counts. */
    invoices: db.selectFrom("invoice_index").select((eb) => [
      eb.fn.countAll<number>().as("total"),
      eb.fn
        .countAll<number>()
        .filterWhere("status", "!=", "DRAFT")
        .as("issued"),
    ]),
    /** The overdue invoices themselves, the most overdue first. */
    overdue: db
      .selectFrom("invoice_index")
      .selectAll()
      .where("status", "=", "OPEN")
      .where("due_at", "is not", null)
      .where("due_at", "<", now)
      .orderBy("due_at", "asc")
      .orderBy("document_id", "asc"),
    /** Transaction counts: to review and the readiness ratios. */
    transactions: db
      .selectFrom("transaction_index")
      .select((eb) => [
        eb.fn.countAll<number>().as("total"),
        eb.fn.countAll<number>().filterWhere("status", "=", "NEW").as("new"),
        eb.fn
          .countAll<number>()
          .filterWhere("status", "=", "MATCHED")
          .as("matched"),
        eb.fn
          .countAll<number>()
          .filterWhere("category", "=", "SALES")
          .as("sales"),
      ]),
    /**
     * Money in and out per day and currency, transfers and excluded rows left
     * out: a day's amounts are converted at that day's rate, then added up
     * per month.
     */
    months: db
      .selectFrom("transaction_index")
      .select("currency")
      .select((eb) => [
        // "YYYY-MM-DD": its first seven characters are the dashboard's month.
        eb
          .fn<string>("substr", [eb.ref("booked_at"), eb.lit(1), eb.lit(10)])
          .as("day"),
        eb.fn.sum<number>("amount").filterWhere("amount", ">", 0).as("in"),
        eb.fn.sum<number>("amount").filterWhere("amount", "<", 0).as("out"),
      ])
      // pending rows are not booked yet
      .where("status", "not in", ["EXCLUDED", "PENDING"])
      .where("category", "!=", "TRANSFER")
      .where("booked_at", ">=", months[0])
      .where("booked_at", "<", nextMonth(months[months.length - 1]))
      .groupBy("currency")
      .groupBy((eb) =>
        eb.fn<string>("substr", [eb.ref("booked_at"), eb.lit(1), eb.lit(10)]),
      ),
    /**
     * Spend by category, day and currency over the last 90 days: outflows
     * that are spending (not transfers, payroll, tax). The six largest
     * categories are picked once the amounts are in one currency.
     */
    spend: db
      .selectFrom("transaction_index")
      .select(["category", "currency"])
      .select((eb) => [
        eb
          .fn<string>("substr", [eb.ref("booked_at"), eb.lit(1), eb.lit(10)])
          .as("day"),
        eb.fn.sum<number>("amount").as("spent"),
      ])
      .where("amount", "<", 0)
      .where("status", "not in", ["EXCLUDED", "PENDING"])
      .where("category", "not in", ["TRANSFER", "PAYROLL", "TAX"])
      .where("booked_at", ">=", since)
      .groupBy(["category", "currency"])
      .groupBy((eb) =>
        eb.fn<string>("substr", [eb.ref("booked_at"), eb.lit(1), eb.lit(10)]),
      ),
    /** The seven latest transactions. */
    recent: db
      .selectFrom("transaction_index")
      .selectAll()
      .orderBy("booked_at", "desc")
      .orderBy("id", "desc")
      .limit(7),
  };
}

type Num = number | string | null | undefined;

/** How many categories the spend chart shows. */
export const SPEND_CATEGORIES = 6;

export interface DashboardResults {
  positions: readonly { currency: string; cash: Num; card: Num }[];
  open: readonly {
    direction: string;
    currency: string;
    outstanding: Num;
    /** Null on a row not refilled yet: the books' rate is used. */
    rates: string | null;
  }[];
  invoices: { total: Num; issued: Num } | undefined;
  overdue: readonly InvoiceRow[];
  transactions: { total: Num; new: Num; matched: Num; sales: Num } | undefined;
  months: readonly { day: string; currency: string; in: Num; out: Num }[];
  spend: readonly {
    category: string;
    day: string;
    currency: string;
    spent: Num;
  }[];
  recent: readonly TransactionRow[];
}

export interface DashboardMonth {
  /** "YYYY-MM" */
  key: string;
  in: number;
  out: number;
}

export interface DashboardSpend {
  category: string;
  amount: number;
}

export interface DashboardStats {
  /** What the amounts below are in: the main currency of the books. */
  bookCurrency: string;
  /**
   * The currencies a total left out because the books hold no rate for them:
   * such amounts are never added as if they were the main currency.
   */
  unconverted: string[];
  cash: number;
  card: number;
  receivable: number;
  payable: number;
  overdue: InvoiceListRow[];
  toReview: number;
  months: DashboardMonth[];
  spend: DashboardSpend[];
  /** Transactions categorised, as a percentage (0 with no transactions). */
  readiness: number;
  /** The readiness rows: percentages, 100 when there is nothing to count. */
  categorisedPct: number;
  matchedPct: number;
  issuedPct: number;
  transactionCount: number;
  categorisedCount: number;
  matchedCount: number;
  salesCount: number;
  invoiceCount: number;
  issuedCount: number;
  recent: TransactionListRow[];
}

const n = (v: Num): number => Number(v ?? 0) || 0;

/** The dashboard's numbers from its queries' results, as the dashboard's `stats` computes them. */
export function toDashboardStats(
  nowMs: number,
  r: DashboardResults,
  fx: Fx = new Fx(DEFAULT_BOOK_CURRENCY, []),
): DashboardStats {
  const now = new Date(nowMs).toISOString();
  // Positions are what is held today: the latest rate.
  let cash = 0;
  let card = 0;
  for (const p of r.positions) {
    cash += fx.convert(n(p.cash), p.currency) ?? 0;
    card += fx.convert(n(p.card), p.currency) ?? 0;
  }
  let receivable = 0;
  let payable = 0;
  for (const i of r.open) {
    const owed =
      fx.convertInvoice(n(i.outstanding), i.currency, parseOwnRates(i.rates)) ??
      0;
    if (i.direction === "OUTGOING") receivable += owed;
    else if (i.direction === "INCOMING") payable += owed;
  }
  // Flows happened on a day: that day's rate.
  const byMonth = new Map<string, { in: number; out: number }>();
  for (const m of r.months) {
    const key = m.day.slice(0, 7);
    const sum = byMonth.get(key) ?? { in: 0, out: 0 };
    sum.in += fx.convert(n(m.in), m.currency, m.day) ?? 0;
    sum.out += fx.convert(n(m.out), m.currency, m.day) ?? 0;
    byMonth.set(key, sum);
  }
  const months = dashboardMonths(nowMs).map((key) => {
    const m = byMonth.get(key);
    // `out` sums negative amounts: the bars show it as a positive outflow.
    return {
      key,
      in: roundMoney(m?.in ?? 0),
      out: roundMoney(Math.abs(m?.out ?? 0)),
    };
  });
  const byCategory = new Map<string, number>();
  for (const s of r.spend) {
    const spent = fx.convert(n(s.spent), s.currency, s.day);
    if (spent === null) continue;
    byCategory.set(s.category, (byCategory.get(s.category) ?? 0) + spent);
  }
  const overdue = r.overdue.map((row) => toInvoiceRow(row, now, fx));
  const total = n(r.transactions?.total);
  const categorised = total - n(r.transactions?.new);
  const matched = n(r.transactions?.matched);
  const sales = n(r.transactions?.sales);
  const invoiceCount = n(r.invoices?.total);
  const issued = n(r.invoices?.issued);
  const pctOf = (num: number, den: number) =>
    den ? Math.round((num / den) * 100) : 100;
  return {
    bookCurrency: fx.bookCurrency,
    unconverted: fx.unconverted(),
    cash: roundMoney(cash),
    card: roundMoney(card),
    receivable: roundMoney(receivable),
    payable: roundMoney(payable),
    overdue,
    toReview: n(r.transactions?.new),
    months,
    spend: [...byCategory]
      .map(([category, spent]) => ({
        category,
        amount: roundMoney(Math.abs(spent)),
      }))
      // the largest first, a tie by name so the order is stable
      .sort(
        (a, b) => b.amount - a.amount || a.category.localeCompare(b.category),
      )
      .slice(0, SPEND_CATEGORIES),
    readiness: total ? Math.round((categorised / total) * 100) : 0,
    categorisedPct: pctOf(categorised, total),
    matchedPct: pctOf(matched, sales),
    issuedPct: pctOf(issued, invoiceCount),
    transactionCount: total,
    categorisedCount: categorised,
    matchedCount: matched,
    salesCount: sales,
    invoiceCount,
    issuedCount: issued,
    recent: r.recent.map(toTransactionRow),
  };
}

/** Every dashboard query in one parallel round, folded. */
export async function loadDashboard(
  db: FinanceQueryBuilder,
  nowMs: number,
  restrict: QueryRestriction = (q) => q,
): Promise<DashboardStats> {
  const q = dashboardQueries(db, nowMs);
  const [fx, positions, open, invoices, overdue, transactions, months, spend, recent] =
    await Promise.all([
      loadFx(db, restrict),
      restrict(q.positions, "document_id").execute(),
      restrict(q.open, "document_id").execute(),
      restrict(q.invoices, "document_id").executeTakeFirst(),
      restrict(q.overdue, "document_id").execute(),
      restrict(q.transactions, "account_id").executeTakeFirst(),
      restrict(q.months, "account_id").execute(),
      restrict(q.spend, "account_id").execute(),
      restrict(q.recent, "account_id").execute(),
    ]);
  return toDashboardStats(
    nowMs,
    { positions, open, invoices, overdue, transactions, months, spend, recent },
    fx,
  );
}

/* ------------------------------------------------- numbers and our party */

/**
 * Every numbered invoice in a direction, highest number first: the issue
 * dialog's "already used" and the credit note's "corrects" picker. Only
 * numbers, so a direction with years of invoices is still a small answer.
 */
export function invoiceNumbersQuery(db: FinanceQueryBuilder, direction: string) {
  return db
    .selectFrom("invoice_index")
    .select(["document_id", "number", "kind", "issued_at"])
    .where("direction", "=", direction)
    .where("number", "is not", null)
    .orderBy("list_key", "desc")
    .orderBy("document_id", "desc");
}

export interface InvoiceNumberRow {
  id: string;
  number: string;
  /** INVOICE | CREDIT_NOTE */
  kind: string;
  issuedAt: string | null;
}

export function toInvoiceNumberRow(
  r: Pick<InvoiceRow, "document_id" | "number" | "kind" | "issued_at">,
): InvoiceNumberRow {
  return {
    id: r.document_id,
    number: r.number ?? "",
    kind: r.kind,
    issuedAt: r.issued_at,
  };
}

/**
 * The next number in the sequence the latest issued invoice in that
 * direction uses: "2026009" → "2026010", "INV-2026-0012" → "INV-2026-0013".
 * A new year restarts a sequence that starts with the year. The same rule as
 * `nextNumber` in editors/sektar/kit/invoice.ts (queries.spec.ts checks they
 * agree), over the numbers alone.
 */
export function nextNumberFrom(
  used: readonly string[],
  direction: string,
  at = new Date(),
): string {
  const year = String(at.getUTCFullYear());
  const numbers = used.filter(Boolean);
  const sameYear = numbers.filter((n) => n.includes(year));
  const pool = sameYear.length ? sameYear : numbers;
  const best = pool
    .map((n) => {
      const m = /^(.*?)(\d+)$/.exec(n);
      return m ? { prefix: m[1], digits: m[2], value: Number(m[2]) } : null;
    })
    .filter(
      (x): x is { prefix: string; digits: string; value: number } => x !== null,
    )
    .sort((a, b) => b.value - a.value)
    .at(0);
  if (!best)
    return direction === "OUTGOING" ? `${year}001` : `BILL-${year}-001`;
  if (!sameYear.length) {
    // Last year's sequence carries the year: this year's starts again at 1
    // ("2025015" → "2026001", "INV-2025-0012" → "INV-2026-0001").
    const lastYear = String(at.getUTCFullYear() - 1);
    const joined = best.prefix + best.digits;
    const at4 = joined.indexOf(lastYear);
    const tail = /^(.*?)(\d+)$/.exec(at4 >= 0 ? joined.slice(at4 + 4) : "");
    if (at4 >= 0 && tail)
      return (
        joined.slice(0, at4) +
        year +
        tail[1] +
        "1".padStart(tail[2].length, "0")
      );
  }
  const next = String(best.value + 1).padStart(best.digits.length, "0");
  return best.prefix + next;
}

/** The fields of a party a new invoice copies for our side. */
export const PARTY_FIELDS = [
  "name",
  "street",
  "additionalStreet",
  "postalCode",
  "city",
  "region",
  "country",
  "vatId",
  "registrationId",
  "registrationScheme",
  "endpointId",
  "endpointScheme",
  "email",
  "phone",
] as const;

export type OurParty = Record<(typeof PARTY_FIELDS)[number], string | null>;

/** Our side as the row stores it (JSON), with every field present; null when there is none. */
export function toOurParty(json: string | null | undefined): OurParty | null {
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const source = parsed as Record<string, unknown>;
  const party = {} as OurParty;
  for (const field of PARTY_FIELDS) {
    const v = source[field];
    party[field] = typeof v === "string" ? v : null;
  }
  return party.name ? party : null;
}

/**
 * Our details as the latest invoice in that direction has them (by issue
 * date, else creation): there is no company profile yet, so each new
 * invoice starts from the last one.
 */
export function latestOurPartyQuery(db: FinanceQueryBuilder, direction: string) {
  return db
    .selectFrom("invoice_index")
    .select("our_party")
    .where("direction", "=", direction)
    .where("our_party", "is not", null)
    .orderBy((eb) => eb.fn.coalesce("issued_at", "created_at"), "desc")
    .orderBy("document_id", "desc")
    .limit(1);
}

/* ---------------------------------------------------------------- expenses */

/** The claim statuses, in the order the board's columns read them. */
export const EXPENSE_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "REIMBURSED",
] as const;

export interface ExpenseFilter {
  /** Any of these statuses; every status when absent or empty. */
  statuses?: readonly string[] | null;
  /** Lower-cased words over title, submitter and merchants. */
  words?: readonly string[];
}

function expensesFiltered(db: FinanceQueryBuilder, f: ExpenseFilter) {
  let q = db.selectFrom("expense_index");
  if (f.statuses?.length) q = q.where("status", "in", [...f.statuses]);
  for (const word of f.words ?? []) {
    if (word) q = q.where("search_text", "like", likeWord(word));
  }
  return q;
}

/** One page of claims, the latest changed first. One row more than the page. */
export function expensesQuery(
  db: FinanceQueryBuilder,
  f: ExpenseFilter,
  page: { offset?: number | null; limit: number },
) {
  const ordered = expensesFiltered(db, f)
    .selectAll()
    .orderBy("updated_at", "desc")
    .orderBy("document_id", "desc")
    .limit(page.limit + 1);
  return page.offset ? ordered.offset(page.offset) : ordered;
}

/** How many claims the filters match. */
export function expenseCountQuery(db: FinanceQueryBuilder, f: ExpenseFilter) {
  return expensesFiltered(db, f).select((eb) =>
    eb.fn.countAll<number>().as("n"),
  );
}

/** Claims per status and currency with their totals, for the words given (the board's columns and its cards). */
export function expenseStatusQuery(
  db: FinanceQueryBuilder,
  words?: readonly string[],
) {
  return expensesFiltered(db, { words })
    .select(["status", "currency"])
    .select((eb) => [
      eb.fn.countAll<number>().as("n"),
      eb.fn.sum<number>("total").as("total"),
      eb.fn.sum<number>("reimbursable").as("reimbursable"),
    ])
    .groupBy(["status", "currency"]);
}

export interface ExpenseStatusCount {
  status: string;
  count: number;
  /** The claims' totals added up, in the main currency of the books. */
  total: number;
  reimbursable: number;
}

export interface ExpenseCounts {
  /** What the totals are in: the main currency of the books. */
  bookCurrency: string;
  /** The currencies the totals left out: the books hold no rate for them. */
  unconverted: string[];
  all: number;
  /** One entry per status, in EXPENSE_STATUSES order. */
  byStatus: ExpenseStatusCount[];
}

/**
 * The board's counts and totals. What is owed is a position: the claims are
 * converted at the books' latest rate.
 */
export function toExpenseCounts(
  rows: readonly {
    status: string;
    currency: string;
    n: Num;
    total: Num;
    reimbursable: Num;
  }[],
  fx: Fx = new Fx(DEFAULT_BOOK_CURRENCY, []),
): ExpenseCounts {
  const byStatus = EXPENSE_STATUSES.map((status) => {
    let count = 0;
    let total = 0;
    let reimbursable = 0;
    for (const r of rows) {
      if (r.status !== status) continue;
      count += n(r.n);
      total += fx.convert(n(r.total), r.currency) ?? 0;
      reimbursable += fx.convert(n(r.reimbursable), r.currency) ?? 0;
    }
    return {
      status,
      count,
      total: roundMoney(total),
      reimbursable: roundMoney(reimbursable),
    };
  });
  return {
    bookCurrency: fx.bookCurrency,
    unconverted: fx.unconverted(),
    all: byStatus.reduce((sum, s) => sum + s.count, 0),
    byStatus,
  };
}

/**
 * Receipts spent after `since` (ISO), per day and currency: the board's
 * 90-day spend. A receipt is in its claim's currency.
 */
export function expenseSpendQuery(db: FinanceQueryBuilder, since: string) {
  return db
    .selectFrom("expense_item_index")
    .innerJoin(
      "expense_index",
      "expense_index.document_id",
      "expense_item_index.report_id",
    )
    .select("expense_index.currency as currency")
    .select((eb) => [
      eb
        .fn<string>("substr", [
          eb.ref("expense_item_index.spent_at"),
          eb.lit(1),
          eb.lit(10),
        ])
        .as("day"),
      eb.fn.sum<number>("expense_item_index.amount").as("spent"),
    ])
    .where("expense_item_index.spent_at", ">", since)
    .groupBy("expense_index.currency")
    .groupBy((eb) =>
      eb.fn<string>("substr", [
        eb.ref("expense_item_index.spent_at"),
        eb.lit(1),
        eb.lit(10),
      ]),
    );
}

/** The 90-day spend in the main currency: each day's receipts at that day's rate. */
export function toExpenseSpend(
  rows: readonly { currency: string; day: string; spent: Num }[],
  fx: Fx = new Fx(DEFAULT_BOOK_CURRENCY, []),
): number {
  let spent = 0;
  for (const r of rows) spent += fx.convert(n(r.spent), r.currency, r.day) ?? 0;
  return roundMoney(spent);
}

/** The instant 90 days before `nowMs`, as the spend is measured from. */
export function spendSince(nowMs: number): string {
  return new Date(nowMs - 90 * DAY_MS).toISOString();
}

export interface ExpenseListRow {
  id: string;
  title: string | null;
  submitterName: string | null;
  submitterEmail: string | null;
  status: string;
  currency: string;
  total: number;
  reimbursable: number;
  vatTotal: number;
  itemCount: number;
  /** Distinct, in item order. */
  categories: string[];
  firstSpentAt: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  reimbursedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpensePageResult {
  items: ExpenseListRow[];
  total: number;
  hasMore: boolean;
}

export function toExpenseRow(r: ExpenseRow): ExpenseListRow {
  return {
    id: r.document_id,
    title: r.title,
    submitterName: r.submitter_name,
    submitterEmail: r.submitter_email,
    status: r.status,
    currency: r.currency,
    total: Number(r.total),
    reimbursable: Number(r.reimbursable),
    vatTotal: Number(r.vat_total),
    itemCount: Number(r.item_count),
    categories: r.categories ? r.categories.split(",") : [],
    firstSpentAt: r.first_spent_at,
    submittedAt: r.submitted_at,
    decidedAt: r.decided_at,
    reimbursedAt: r.reimbursed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/* ---------------------------------------------------------------- contacts */

/** The Contacts board's filter: the active ones, by relationship, or the archived. */
export type ContactView = "all" | "customers" | "suppliers" | "archived";
export const CONTACT_VIEWS: readonly ContactView[] = [
  "all",
  "customers",
  "suppliers",
  "archived",
];

export interface ContactFilter {
  view?: ContactView;
  /** Lower-cased words over name, email, city and tags. */
  words?: readonly string[];
  /** Only these contacts. */
  id?: string | null;
}

function contactsFiltered(db: FinanceQueryBuilder, f: ContactFilter) {
  let q = db.selectFrom("contact_index");
  if (f.id) q = q.where("contact_index.document_id", "=", f.id);
  switch (f.view) {
    case "archived":
      q = q.where("contact_index.status", "=", "ARCHIVED");
      break;
    case "customers":
      q = q
        .where("contact_index.status", "=", "ACTIVE")
        .where("contact_index.kind", "in", ["CUSTOMER", "BOTH"]);
      break;
    case "suppliers":
      q = q
        .where("contact_index.status", "=", "ACTIVE")
        .where("contact_index.kind", "in", ["SUPPLIER", "BOTH"]);
      break;
    case "all":
      q = q.where("contact_index.status", "=", "ACTIVE");
      break;
    default:
      // no view: every contact (a lookup by id)
      break;
  }
  for (const word of f.words ?? []) {
    if (word) q = q.where("contact_index.search_text", "like", likeWord(word));
  }
  return q;
}

/**
 * One page of contacts by name, each with what the books hold on it: its
 * OPEN invoices (count, book outstanding) and its bank activity (count,
 * latest booking). The aggregates are subqueries over the invoice and
 * transaction rows, each narrowed by `restrict` to what the caller may
 * read, so a total never counts a document the caller could not open.
 */
export function contactsQuery(
  db: FinanceQueryBuilder,
  f: ContactFilter,
  page: { offset?: number | null; limit: number },
  restrict: QueryRestriction = NO_RESTRICTION,
) {
  const ordered = contactsFiltered(db, f)
    .selectAll("contact_index")
    .select((eb) => [
      restrict(
        eb
          .selectFrom("invoice_index")
          .select((s) => s.fn.countAll<number>().as("n"))
          .whereRef(
            "invoice_index.counterparty_contact_id",
            "=",
            "contact_index.document_id",
          )
          .where("invoice_index.status", "=", "OPEN"),
        "invoice_index.document_id",
      ).as("open_count"),
      restrict(
        eb
          .selectFrom("transaction_index")
          .select((s) => s.fn.countAll<number>().as("n"))
          .whereRef(
            "transaction_index.contact_id",
            "=",
            "contact_index.document_id",
          ),
        "transaction_index.account_id",
      ).as("tx_count"),
      restrict(
        eb
          .selectFrom("transaction_index")
          .select((s) => s.fn.max("transaction_index.booked_at").as("n"))
          .whereRef(
            "transaction_index.contact_id",
            "=",
            "contact_index.document_id",
          ),
        "transaction_index.account_id",
      ).as("last_tx_at"),
    ])
    // The board's `(name ?? "").localeCompare`, case-insensitively.
    .orderBy((eb) =>
      eb.fn("lower", [eb.fn.coalesce("contact_index.name", eb.val(""))]),
    )
    .orderBy("contact_index.document_id", "asc")
    .limit(page.limit + 1);
  return page.offset ? ordered.offset(page.offset) : ordered;
}

/**
 * What the OPEN invoices of the contacts given still owe, per contact, in the
 * main currency: each invoice converted once, on reading, at its own rate
 * else the books' latest. An invoice with no rate is left out.
 */
export async function loadOpenByContact(
  db: FinanceQueryBuilder,
  contactIds: readonly string[],
  fx: Fx,
  restrict: QueryRestriction = NO_RESTRICTION,
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (contactIds.length === 0) return totals;
  const rows = await restrict(
    db
      .selectFrom("invoice_index")
      .select(["counterparty_contact_id", "currency", "outstanding", "rates"])
      .where("status", "=", "OPEN")
      .where("counterparty_contact_id", "in", [...contactIds]),
    "document_id",
  ).execute();
  for (const r of rows) {
    const id = r.counterparty_contact_id;
    if (!id) continue;
    const owed = fx.convertInvoice(
      Number(r.outstanding),
      r.currency,
      parseOwnRates(r.rates),
    );
    if (owed === null) continue;
    totals.set(id, (totals.get(id) ?? 0) + owed);
  }
  for (const [id, total] of totals) totals.set(id, roundMoney(total));
  return totals;
}

/** How many contacts the filters match. */
export function contactCountQuery(db: FinanceQueryBuilder, f: ContactFilter) {
  return contactsFiltered(db, f).select((eb) =>
    eb.fn.countAll<number>().as("n"),
  );
}

/** The board's filter counts: active ones in all, per relationship, and the archived. */
export function contactViewCountsQuery(db: FinanceQueryBuilder) {
  return db.selectFrom("contact_index").select((eb) => [
    eb.fn.countAll<number>().filterWhere("status", "=", "ACTIVE").as("all"),
    eb.fn
      .countAll<number>()
      .filterWhere((w) =>
        w.and([
          w("status", "=", "ACTIVE"),
          w("kind", "in", ["CUSTOMER", "BOTH"]),
        ]),
      )
      .as("customers"),
    eb.fn
      .countAll<number>()
      .filterWhere((w) =>
        w.and([
          w("status", "=", "ACTIVE"),
          w("kind", "in", ["SUPPLIER", "BOTH"]),
        ]),
      )
      .as("suppliers"),
    eb.fn
      .countAll<number>()
      .filterWhere("status", "=", "ARCHIVED")
      .as("archived"),
  ]);
}

export interface ContactCounts {
  all: number;
  customers: number;
  suppliers: number;
  archived: number;
}

export function toContactCounts(
  r:
    | { all: Num; customers: Num; suppliers: Num; archived: Num }
    | undefined,
): ContactCounts {
  return {
    all: n(r?.all),
    customers: n(r?.customers),
    suppliers: n(r?.suppliers),
    archived: n(r?.archived),
  };
}

/** The names of the contacts asked for (a table's rows name a few). */
export function contactNamesQuery(
  db: FinanceQueryBuilder,
  ids: readonly string[],
) {
  // `in ()` is not SQL: no id asks for no row.
  const q = db.selectFrom("contact_index").select(["document_id", "name"]);
  return ids.length
    ? q.where("document_id", "in", [...ids])
    : q.where("document_id", "is", null);
}

export interface ContactName {
  id: string;
  name: string | null;
}

export interface ContactListRow {
  id: string;
  name: string | null;
  kind: string;
  status: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  vatId: string | null;
  registrationNumber: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  paymentTermsDays: number;
  defaultCategory: string;
  tags: string[];
  /** OPEN invoices whose other party is this contact. */
  openInvoiceCount: number;
  /** What they still owe, added up in the main currency of the books. */
  openBookOutstanding: number;
  /** Bank transactions linked to the contact. */
  transactionCount: number;
  lastTransactionAt: string | null;
}

export interface ContactPageResult {
  items: ContactListRow[];
  total: number;
  hasMore: boolean;
}

/** Tags as stored (a JSON array), never throwing on a bad row. */
function tagsOf(json: string | null | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(json ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((t): t is string => typeof t === "string")
      : [];
  } catch {
    return [];
  }
}

export function toContactRow(
  r: ContactRow & {
    open_count?: Num;
    tx_count?: Num;
    last_tx_at?: string | null;
  },
  /** `loadOpenByContact`'s answer for the page the row is on. */
  openByContact: ReadonlyMap<string, number> = new Map(),
): ContactListRow {
  return {
    id: r.document_id,
    name: r.name,
    kind: r.kind,
    status: r.status,
    email: r.email,
    phone: r.phone,
    website: r.website,
    vatId: r.vat_id,
    registrationNumber: r.registration_number,
    street: r.street,
    postalCode: r.postal_code,
    city: r.city,
    country: r.country,
    paymentTermsDays: Number(r.payment_terms_days),
    defaultCategory: r.default_category,
    tags: tagsOf(r.tags),
    openInvoiceCount: n(r.open_count),
    openBookOutstanding: openByContact.get(r.document_id) ?? 0,
    transactionCount: n(r.tx_count),
    lastTransactionAt: r.last_tx_at ?? null,
  };
}

/* ----------------------------------------------------- one transaction */

export interface TransactionDetailRow extends TransactionListRow {
  accountName: string | null;
  /** CURRENT | SAVINGS | CREDIT_CARD: a card payment is recorded as such on the invoice. */
  accountKind: string;
  /** What it is matched to, as the detail names it: the invoice's number or the claim's title. */
  matchedLabel: string | null;
}

/**
 * One transaction with what its detail shows of its account and of what it
 * is matched to; null when the index holds no such transaction (or the
 * caller may not read it).
 */
export async function loadTransaction(
  db: FinanceQueryBuilder,
  id: string,
  restrict: QueryRestriction = NO_RESTRICTION,
): Promise<TransactionDetailRow | null> {
  const row = await restrict(
    db.selectFrom("transaction_index").selectAll().where("id", "=", id),
    "account_id",
  ).executeTakeFirst();
  if (!row) return null;
  const matchedId = row.matched_document_id;
  const [account, invoice, claim] = await Promise.all([
    restrict(
      db
        .selectFrom("account_index")
        .select(["name", "kind"])
        .where("document_id", "=", row.account_id),
      "document_id",
    ).executeTakeFirst(),
    matchedId && row.matched_kind === "INVOICE"
      ? restrict(
          db
            .selectFrom("invoice_index")
            .select("number")
            .where("document_id", "=", matchedId),
          "document_id",
        ).executeTakeFirst()
      : undefined,
    matchedId && row.matched_kind !== "INVOICE"
      ? restrict(
          db
            .selectFrom("expense_index")
            .select("title")
            .where("document_id", "=", matchedId),
          "document_id",
        ).executeTakeFirst()
      : undefined,
  ]);
  return {
    ...toTransactionRow(row),
    accountName: account?.name ?? null,
    accountKind: account?.kind ?? "CURRENT",
    matchedLabel: matchedId
      ? row.matched_kind === "INVOICE"
        ? (invoice?.number ?? "Invoice")
        : (claim?.title ?? "Expense claim")
      : null,
  };
}

/* --------------------------------------------------- match candidates */

export interface MatchCandidate {
  /** INVOICE | EXPENSE */
  kind: string;
  id: string;
  label: string;
  /** What is left to pay (an invoice) or to reimburse (a claim). */
  amount: number;
  /** How far `amount` is from the transaction's. */
  distance: number;
}

const MATCH_LIMIT = 8;

/**
 * What a transaction of `amount` could settle, closest amount first: OPEN
 * invoices in the money's direction (money in pays a sale, money out a
 * bill), and for money out the claims approved or awaiting approval.
 */
export async function loadMatchCandidates(
  db: FinanceQueryBuilder,
  amount: number,
  restrict: QueryRestriction = NO_RESTRICTION,
): Promise<MatchCandidate[]> {
  const size = Math.abs(amount);
  const [invoices, claims] = await Promise.all([
    restrict(
      db
        .selectFrom("invoice_index")
        .select(["document_id", "number", "counterparty_name", "outstanding"])
        .where("status", "=", "OPEN")
        .where("direction", "=", amount > 0 ? "OUTGOING" : "INCOMING")
        .orderBy((eb) => eb.fn("abs", [eb("outstanding", "-", size)]))
        .orderBy("document_id", "asc")
        .limit(MATCH_LIMIT),
      "document_id",
    ).execute(),
    amount < 0
      ? restrict(
          db
            .selectFrom("expense_index")
            .select(["document_id", "title", "submitter_name", "reimbursable"])
            .where("status", "in", ["APPROVED", "SUBMITTED"])
            .orderBy((eb) => eb.fn("abs", [eb("reimbursable", "-", size)]))
            .orderBy("document_id", "asc")
            .limit(MATCH_LIMIT),
          "document_id",
        ).execute()
      : [],
  ]);
  const found: MatchCandidate[] = [
    ...invoices.map((i) => ({
      kind: "INVOICE",
      id: i.document_id,
      label: `${i.number ?? "Draft"} · ${i.counterparty_name ?? ""}`,
      amount: Number(i.outstanding),
      distance: Math.abs(Number(i.outstanding) - size),
    })),
    ...claims.map((c) => ({
      kind: "EXPENSE",
      id: c.document_id,
      label: `${c.title ?? "Claim"} · ${c.submitter_name ?? ""}`,
      amount: Number(c.reimbursable),
      distance: Math.abs(Number(c.reimbursable) - size),
    })),
  ];
  return found.sort((a, b) => a.distance - b.distance).slice(0, MATCH_LIMIT);
}

/* ------------------------------------------------------------------ counts */

export interface FinanceCounts {
  accounts: number;
  invoices: number;
  expenses: number;
  contacts: number;
}

/** How many documents of each kind the index holds: the business drive's badges. */
export async function loadCounts(
  db: FinanceQueryBuilder,
  restrict: QueryRestriction = NO_RESTRICTION,
): Promise<FinanceCounts> {
  const [accounts, invoices, expenses, contacts] = await Promise.all([
    restrict(
      db.selectFrom("account_index").select((eb) => eb.fn.countAll<number>().as("n")),
      "document_id",
    ).executeTakeFirst(),
    restrict(
      db.selectFrom("invoice_index").select((eb) => eb.fn.countAll<number>().as("n")),
      "document_id",
    ).executeTakeFirst(),
    restrict(
      db.selectFrom("expense_index").select((eb) => eb.fn.countAll<number>().as("n")),
      "document_id",
    ).executeTakeFirst(),
    restrict(
      db.selectFrom("contact_index").select((eb) => eb.fn.countAll<number>().as("n")),
      "document_id",
    ).executeTakeFirst(),
  ]);
  return {
    accounts: n(accounts?.n),
    invoices: n(invoices?.n),
    expenses: n(expenses?.n),
    contacts: n(contacts?.n),
  };
}
