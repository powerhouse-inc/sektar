// Reading the finance boards through the finance index rather than their
// documents (processors/finance-index).
//
// The Finances dashboard, the Invoices list, the Transactions table, the
// Expenses and Contacts boards, and every picker over them show rows and
// sums. Loading every account document (each carries every
// transaction ever imported) and every invoice to draw them is what made the
// boards slow; the index holds one lean row per invoice, account and
// transaction, and a document is loaded only when it is opened for editing.
//
// Where the drive is a remote (Vetra's Connect is a pure remote client), the
// switchboard answers over GraphQL (subgraphs/finance-index). Where the tab's
// own reactor runs the processor, the very same Kysely queries run against
// its database. Both answer through one fetcher, so the paging, the memory
// of answers and the refresh on change are shared (kit/paged.ts).
import { useReactorClient, useRelationalDb } from "@powerhousedao/reactor-browser";
import { indexGql as gql } from "./index-gql.js";
import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import type {
  AccountKind,
  MatchKind,
  TransactionCategory,
  TransactionStatus,
} from "document-models/bank-account";
import type { ContactKind } from "document-models/contact";
import type { ExpenseStatus } from "document-models/expense-report";
import type { SetBuyerInput } from "document-models/invoice";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACCOUNT_DOCUMENT_TYPE,
  accountsQuery,
  CONTACT_DOCUMENT_TYPE,
  contactCountQuery,
  contactNamesQuery,
  contactsQuery,
  contactViewCountsQuery,
  EXPENSE_DOCUMENT_TYPE,
  expenseCountQuery,
  expenseSpendQuery,
  expensesQuery,
  expenseStatusQuery,
  FINANCE_DOCUMENT_TYPES,
  FINANCE_PAGE,
  FinanceIndex,
  INVOICE_DOCUMENT_TYPE,
  INVOICE_VIEWS,
  invoiceCountQuery,
  invoiceNumbersQuery,
  invoicesQuery,
  invoiceViewCountsQuery,
  isoNow,
  latestOurPartyQuery,
  loadCounts,
  loadDashboard,
  loadMatchCandidates,
  loadTransaction,
  nextNumberFrom,
  PARTY_FIELDS,
  searchWords,
  spendSince,
  toAccountRow,
  toContactCounts,
  toContactRow,
  toExpenseCounts,
  toExpenseRow,
  toInvoiceCounts,
  toInvoiceNumberRow,
  toInvoiceRow,
  toOurParty,
  toTransactionCounts,
  toTransactionRow,
  transactionCountQuery,
  transactionCountsQuery,
  transactionsQuery,
  type AccountListRow,
  type ContactCounts,
  type ContactListRow,
  type ContactName,
  type ContactView,
  type DashboardMonth,
  type DashboardSpend,
  type DashboardStats,
  type DB,
  type ExpenseCounts,
  type ExpenseListRow,
  type ExpenseStatusCount,
  type FinanceCounts,
  type FinanceQueryBuilder,
  type InvoiceCounts,
  type InvoiceListRow,
  type InvoiceNumberRow,
  type InvoiceView,
  type MatchCandidate,
  type OurParty,
  type TransactionCounts,
  type TransactionDetailRow,
  type TransactionListRow,
  type ViewCount,
} from "../../../processors/finance-index/index.js";
import { useSektarDrive } from "./data.js";
import {
  ACCOUNT_KIND,
  CATEGORY,
  CONTACT_KIND,
  EXPENSE_STATUS,
  TX_STATUS,
} from "./format.js";
import { useMailIndexMode } from "./mail-index.js";
import { usePagedList, type PagedList } from "./paged.js";

/** An invoice as the list shows it (the subgraph's FinanceInvoiceRow). */
export type InvoiceRow = InvoiceListRow;
/** A bank account with its balance and counts (FinanceAccountRow). */
export type AccountRow = AccountListRow;
/** A transaction as the table shows it (FinanceTransactionRow). */
export type TransactionRow = TransactionListRow;
export type {
  DashboardMonth,
  DashboardSpend,
  DashboardStats,
  InvoiceCounts,
  InvoiceView,
  TransactionCounts,
  ViewCount,
};
export { FINANCE_PAGE };

/** Where the index is answered from: the drive's switchboard, the tab's own database, or not yet known. */
export const useFinanceIndexMode = useMailIndexMode;

/* ------------------------------------------------------------ narrowing */

// The index stores enums as text; the boards' lookup tables are keyed by the
// document models' enums. A value the tables do not know falls back rather
// than throwing in a render.

export function categoryOf(value: string): TransactionCategory {
  return value in CATEGORY ? (value as TransactionCategory) : "UNCATEGORIZED";
}

export function txStatusOf(value: string): TransactionStatus {
  return value in TX_STATUS ? (value as TransactionStatus) : "NEW";
}

export function accountKindOf(value: string): AccountKind {
  return value in ACCOUNT_KIND ? (value as AccountKind) : "CURRENT";
}

export function matchKindOf(value: string | null): MatchKind | null {
  return value === "INVOICE" || value === "EXPENSE" ? value : null;
}

/* --------------------------------------------------------------- source */

type Source =
  | { kind: "remote"; base: string; driveId: string }
  | { kind: "local"; db: FinanceQueryBuilder; driveId: string };

/** How the index for `drive` is reached, or null while that is not known. */
function useFinanceSource(drive: DocumentDriveDocument | undefined): {
  source: Source | null;
  /** Names the source in cache keys. */
  tag: string;
  mode: "remote" | "local" | "unknown";
} {
  const mode = useMailIndexMode(drive);
  const driveId = drive?.header.id ?? null;
  // Reads the store's database only; a pure remote client has none and
  // nothing is created here.
  const { db } = useRelationalDb<DB>();
  const base = mode.kind === "remote" ? mode.base : null;
  const local = mode.kind === "local";
  const source = useMemo<Source | null>(() => {
    if (!driveId) return null;
    if (base) return { kind: "remote", base, driveId };
    if (local && db) return { kind: "local", db: FinanceIndex.query<DB>(driveId, db), driveId };
    return null;
  }, [driveId, base, local, db]);
  const tag = source ? `${source.kind === "remote" ? source.base : "local"}|${source.driveId}` : "";
  return { source, tag, mode: mode.kind };
}

/* ---------------------------------------------------------------- wire */

const INVOICE_FIELDS = `id direction kind status number counterpartyName counterpartyContactId subject firstLine currency issuedAt dueAt deliveredAt periodStart periodEnd createdAt gross outstanding bookGross bookOutstanding bookRateKnown overdue issuedCopyId issuedCopyRef lineCount linesMissingAttachments lastPaidAt updatedAt`;
const ACCOUNT_FIELDS = `id name kind institution ibanLast4 currency openingBalance balance txCount newCount lastImportedAt lastBookedAt updatedAt`;
const TRANSACTION_FIELDS = `id accountId bookedAt counterparty description reference category status amount currency contactId matchedDocumentId matchedKind importBatch`;

const INVOICES_QUERY = `query ($d: String!, $dir: String, $v: FinanceInvoiceView, $q: String, $n: String, $o: Int, $l: Int) {
  financeIndex { invoices(driveId: $d, direction: $dir, view: $v, query: $q, now: $n, offset: $o, limit: $l) {
    total
    items { ${INVOICE_FIELDS} }
  } }
}`;

const INVOICE_COUNTS_QUERY = `query ($d: String!, $n: String) {
  financeIndex { invoiceCounts(driveId: $d, now: $n) { outgoing incoming byView { direction view count } } }
}`;

const ACCOUNTS_QUERY = `query ($d: String!) {
  financeIndex { accounts(driveId: $d) { ${ACCOUNT_FIELDS} } }
}`;

const TRANSACTIONS_QUERY = `query ($d: String!, $a: String, $s: String, $q: String, $o: Int, $l: Int) {
  financeIndex { transactions(driveId: $d, accountId: $a, status: $s, query: $q, offset: $o, limit: $l) {
    total
    items { ${TRANSACTION_FIELDS} }
  } }
}`;

const TRANSACTION_COUNTS_QUERY = `query ($d: String!, $a: String) {
  financeIndex { transactionCounts(driveId: $d, accountId: $a) { all new categorised matched excluded pending } }
}`;

const DASHBOARD_QUERY = `query ($d: String!, $n: String!) {
  financeIndex { dashboard(driveId: $d, now: $n) {
    bookCurrency cash card receivable payable
    overdue { ${INVOICE_FIELDS} }
    toReview
    months { key in out }
    spend { category amount }
    readiness categorisedPct matchedPct issuedPct
    transactionCount categorisedCount matchedCount salesCount invoiceCount issuedCount
    recent { ${TRANSACTION_FIELDS} }
  } }
}`;

/** The wire's views are the GraphQL enum (upper case); the kit's are lower. */
function countsFromWire(c: InvoiceCounts): InvoiceCounts {
  return {
    ...c,
    byView: c.byView.map((v) => {
      const view = v.view.toLowerCase();
      return { ...v, view: (INVOICE_VIEWS as readonly string[]).includes(view) ? (view as InvoiceView) : "all" };
    }),
  };
}

/* ------------------------------------------------------------- fetchers */

interface Page<T> {
  items: T[];
  total: number;
}

async function fetchInvoices(
  src: Source,
  f: { direction: string; view: InvoiceView; query: string; now: string },
  page: number,
): Promise<Page<InvoiceRow>> {
  const offset = page * FINANCE_PAGE;
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { invoices: Page<InvoiceRow> } }>(src.base, INVOICES_QUERY, {
      d: src.driveId,
      dir: f.direction,
      v: f.view.toUpperCase(),
      q: f.query || null,
      n: f.now,
      o: offset,
      l: FINANCE_PAGE,
    });
    return data.financeIndex.invoices;
  }
  const filter = { direction: f.direction, view: f.view, words: searchWords(f.query), now: f.now };
  const [rows, count] = await Promise.all([
    invoicesQuery(src.db, filter, { offset, limit: FINANCE_PAGE }).execute(),
    invoiceCountQuery(src.db, filter).executeTakeFirst(),
  ]);
  return {
    items: rows.slice(0, FINANCE_PAGE).map((r) => toInvoiceRow(r, f.now)),
    total: Number(count?.n ?? 0),
  };
}

async function fetchInvoiceCounts(src: Source, now: string): Promise<InvoiceCounts> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { invoiceCounts: InvoiceCounts } }>(src.base, INVOICE_COUNTS_QUERY, {
      d: src.driveId,
      n: now,
    });
    return countsFromWire(data.financeIndex.invoiceCounts);
  }
  return toInvoiceCounts(await invoiceViewCountsQuery(src.db, now).execute());
}

async function fetchAccounts(src: Source): Promise<AccountRow[]> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { accounts: AccountRow[] } }>(src.base, ACCOUNTS_QUERY, {
      d: src.driveId,
    });
    return data.financeIndex.accounts;
  }
  return (await accountsQuery(src.db).execute()).map(toAccountRow);
}

async function fetchTransactions(
  src: Source,
  f: { accountId: string | null; status: string | null; query: string },
  page: number,
): Promise<Page<TransactionRow>> {
  const offset = page * FINANCE_PAGE;
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { transactions: Page<TransactionRow> } }>(
      src.base,
      TRANSACTIONS_QUERY,
      {
        d: src.driveId,
        a: f.accountId,
        s: f.status,
        q: f.query || null,
        o: offset,
        l: FINANCE_PAGE,
      },
    );
    return data.financeIndex.transactions;
  }
  const filter = { accountId: f.accountId, status: f.status, words: searchWords(f.query) };
  const [rows, count] = await Promise.all([
    transactionsQuery(src.db, filter, { offset, limit: FINANCE_PAGE }).execute(),
    transactionCountQuery(src.db, filter).executeTakeFirst(),
  ]);
  return { items: rows.slice(0, FINANCE_PAGE).map(toTransactionRow), total: Number(count?.n ?? 0) };
}

async function fetchTransactionCounts(src: Source, accountId: string | null): Promise<TransactionCounts> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { transactionCounts: TransactionCounts } }>(
      src.base,
      TRANSACTION_COUNTS_QUERY,
      { d: src.driveId, a: accountId },
    );
    return data.financeIndex.transactionCounts;
  }
  return toTransactionCounts(await transactionCountsQuery(src.db, accountId).executeTakeFirst());
}

async function fetchDashboard(src: Source, nowMs: number): Promise<DashboardStats> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { dashboard: DashboardStats } }>(src.base, DASHBOARD_QUERY, {
      d: src.driveId,
      n: new Date(nowMs).toISOString(),
    });
    return data.financeIndex.dashboard;
  }
  return loadDashboard(src.db, nowMs);
}

/* -------------------------------------------------------------- changes */

/** How long a burst of changes is left to settle before a single query is asked again. */
const REFRESH_DEBOUNCE_MS = 800;
/** A quiet board is still re-read now and then: edits from another tab. */
const REFRESH_INTERVAL_MS = 30_000;
const RETRY_MS = 5_000;

/**
 * Documents of `types` changed (edited, added, removed): `onChange` is
 * called once the burst has settled. The reactor client already receives
 * these events for the document cache; the index follows the documents a
 * beat later, which the settling covers. An import is hundreds of
 * operations: it must ask the index once, not hundreds of times.
 */
function useFinanceChanges(enabled: boolean, types: readonly string[], onChange: () => void): void {
  const client = useReactorClient();
  const ref = useRef(onChange);
  ref.current = onChange;
  const key = types.join(",");
  useEffect(() => {
    if (!enabled || !client || !key) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => ref.current(), REFRESH_DEBOUNCE_MS);
    };
    const stops: (() => void)[] = [];
    for (const type of key.split(",")) {
      try {
        stops.push(client.subscribe({ type }, settle));
      } catch {
        // no realtime channel: the poll still follows
      }
    }
    return () => {
      clearTimeout(timer);
      for (const stop of stops) stop();
    };
  }, [enabled, client, key]);
}

/** The typed value is the field the caller reads; the cache holds every answer by key. */
const answers = new Map<string, unknown>();
const ANSWERS_MAX = 48;

function remember(key: string, value: unknown): void {
  answers.delete(key);
  answers.set(key, value);
  while (answers.size > ANSWERS_MAX) {
    const oldest = answers.keys().next().value;
    if (oldest === undefined) break;
    answers.delete(oldest);
  }
}

/**
 * One index query (not a list), asked when `key` changes, again shortly
 * after a change to documents of `types` or a bump of `trigger`, and every
 * half minute while the tab is visible. While a new key is on its way the
 * previous answer stays, so a filter switch never blanks the numbers.
 */
function useIndexValue<T>(options: {
  key: string;
  enabled: boolean;
  fetch: () => Promise<T>;
  types: readonly string[];
  trigger?: unknown;
}): T | undefined {
  const { key, enabled, types, trigger } = options;
  const [answer, setAnswer] = useState<{ key: string; value: T } | null>(() =>
    answers.has(key) ? { key, value: answers.get(key) as T } : null,
  );
  const [tick, setTick] = useState(0);
  const fetchRef = useRef(options.fetch);
  fetchRef.current = options.fetch;
  const known = answer?.key === key;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    // a new key asks at once; a revalidation is coalesced with its neighbours
    const timer = setTimeout(
      () => {
        fetchRef
          .current()
          .then((value) => {
            remember(key, value);
            if (active) setAnswer({ key, value });
          })
          .catch(() => {
            // keep what was known; ask again shortly
            if (active) retry = setTimeout(() => setTick((n) => n + 1), RETRY_MS);
          });
      },
      known ? 300 : 0,
    );
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(retry);
    };
    // `known` only picks the delay; it must not re-ask by itself
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, tick, trigger]);

  // the change events arrive settled already
  const again = useCallback(() => setTick((n) => n + 1), []);
  useFinanceChanges(enabled, types, again);
  useEffect(() => {
    if (!enabled) return;
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") setTick((n) => n + 1);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(poll);
  }, [enabled]);

  if (known) return answer.value;
  if (answers.has(key)) return answers.get(key) as T;
  return answer?.value;
}

/** `value`, once it has stood still for `ms`: a search is asked when typing pauses. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/* --------------------------------------------------------------- patches */

/** How long a change this tab made is shown over the index's row. The index is seconds behind, not minutes. */
const PATCH_TTL_MS = 20_000;

/**
 * Changes this tab just made, laid over the list's rows until the index has
 * caught up (or a while has passed, should the write have failed). A patched
 * row is a new object only while the patch says something the row does not.
 */
function usePatched<T extends { id: string }>(
  list: PagedList<T>,
): PagedList<T> & { patch: (id: string, change: Partial<T>) => void } {
  const [overlay, setOverlay] = useState<Map<string, { change: Partial<T>; at: number }>>(() => new Map());
  const [bumps, setBumps] = useState(0);
  const patch = useCallback((id: string, change: Partial<T>) => {
    setOverlay((prev) => {
      const next = new Map(prev);
      next.set(id, { change: { ...prev.get(id)?.change, ...change }, at: Date.now() });
      return next;
    });
    setBumps((n) => n + 1);
  }, []);
  // expire patches: the index has had its chance
  useEffect(() => {
    if (overlay.size === 0) return;
    const oldest = Math.min(...[...overlay.values()].map((p) => p.at));
    const timer = setTimeout(
      () => {
        const cutoff = Date.now() - PATCH_TTL_MS;
        setOverlay((prev) => new Map([...prev].filter(([, p]) => p.at > cutoff)));
      },
      Math.max(0, oldest + PATCH_TTL_MS - Date.now()) + 50,
    );
    return () => clearTimeout(timer);
  }, [overlay]);

  const baseRowAt = list.rowAt;
  const rowAt = useMemo(() => {
    if (overlay.size === 0) return baseRowAt;
    const merged = new WeakMap<T, T>();
    return (index: number): T | undefined => {
      const row = baseRowAt(index);
      if (!row) return row;
      const p = overlay.get(row.id);
      if (!p) return row;
      const fields = Object.keys(p.change) as (keyof T)[];
      if (fields.every((k) => row[k] === p.change[k])) return row;
      let out = merged.get(row);
      if (!out) {
        out = { ...row, ...p.change };
        merged.set(row, out);
      }
      return out;
    };
  }, [baseRowAt, overlay]);

  return { ...list, rowAt, patch, version: list.version + bumps };
}

/* ----------------------------------------------------------------- api */

const INVOICE_TYPES = [INVOICE_DOCUMENT_TYPE] as const;
const ACCOUNT_TYPES = [ACCOUNT_DOCUMENT_TYPE] as const;
const FINANCE_TYPES = [ACCOUNT_DOCUMENT_TYPE, INVOICE_DOCUMENT_TYPE] as const;
const NO_ACCOUNTS: AccountRow[] = [];

export interface InvoiceListFilter {
  direction: "OUTGOING" | "INCOMING";
  view: InvoiceView;
  /** The top bar's search, raw. */
  query: string;
  /** The instant open and overdue are measured at (ms). The list re-asks when its day changes. */
  now: number;
}

export type InvoiceList = PagedList<InvoiceRow> & {
  /** Per direction and per view; undefined until the index has answered. */
  counts: InvoiceCounts | undefined;
  /** Show a change this tab made on its row before the index catches up. */
  patch: (id: string, change: Partial<InvoiceRow>) => void;
  mode: "remote" | "local" | "unknown";
};

/** The Invoices list for one direction and view, in the workspace's order, paged where the reader is. */
export function useInvoiceList(filter: InvoiceListFilter, drive?: DocumentDriveDocument): InvoiceList {
  const sektar = useSektarDrive();
  const { source, tag, mode } = useFinanceSource(drive ?? sektar);
  const query = useSettled(filter.query.trim().toLowerCase(), 250);
  const day = new Date(filter.now).toISOString().slice(0, 10);
  const nowRef = useRef(filter.now);
  nowRef.current = filter.now;
  const key = JSON.stringify([tag, filter.direction, filter.view, query, day]);
  const fetchPage = useCallback(
    (page: number) => {
      if (!source) return Promise.reject(new Error("The finance index is not reachable yet"));
      return fetchInvoices(
        source,
        { direction: filter.direction, view: filter.view, query, now: isoNow(nowRef.current) },
        page,
      );
    },
    [source, filter.direction, filter.view, query],
  );
  const list = usePagedList<InvoiceRow>({
    kind: "finance-invoices",
    key,
    enabled: source !== null,
    pageSize: FINANCE_PAGE,
    fetchPage,
    refreshDebounceMs: REFRESH_DEBOUNCE_MS,
  });
  // an invoice was edited, issued, paid or removed: any page in view may have moved
  const { invalidate } = list;
  useFinanceChanges(source !== null, INVOICE_TYPES, invalidate);
  const counts = useIndexValue<InvoiceCounts>({
    key: JSON.stringify(["invoice-counts", tag, day]),
    enabled: source !== null,
    fetch: () => (source ? fetchInvoiceCounts(source, isoNow(nowRef.current)) : Promise.reject(new Error("no source"))),
    types: INVOICE_TYPES,
    trigger: list.version,
  });
  const patched = usePatched(list);
  return { ...patched, counts, mode };
}

/** Every bank account with its balance, by name; undefined until the index has answered. */
export function useAccountIndex(drive: DocumentDriveDocument | undefined): AccountRow[] | undefined {
  const { source, tag } = useFinanceSource(drive);
  return useIndexValue<AccountRow[]>({
    key: JSON.stringify(["accounts", tag]),
    enabled: source !== null,
    fetch: () => (source ? fetchAccounts(source) : Promise.reject(new Error("no source"))),
    types: ACCOUNT_TYPES,
  });
}

/** Every bank account with its balance, by name; empty until the index has answered. */
export function useAccountRows(drive: DocumentDriveDocument | undefined): AccountRow[] {
  return useAccountIndex(drive) ?? NO_ACCOUNTS;
}

export type TransactionStatusView = "ALL" | TransactionStatus;

export interface TransactionListFilter {
  /** An account document id, or every account. */
  accountId: string | null;
  status: TransactionStatusView;
  /** The top bar's search, raw. */
  query: string;
}

export type TransactionList = PagedList<TransactionRow> & {
  /** The status tabs' counts for the account filter; undefined until the index has answered. */
  counts: TransactionCounts | undefined;
  /** Show a change this tab made on its row before the index catches up. */
  patch: (id: string, change: Partial<TransactionRow>) => void;
  mode: "remote" | "local" | "unknown";
};

/** The Transactions table, latest booked first, filtered in the index and paged where the reader is. */
export function useTransactionList(filter: TransactionListFilter, drive?: DocumentDriveDocument): TransactionList {
  const sektar = useSektarDrive();
  const { source, tag, mode } = useFinanceSource(drive ?? sektar);
  const query = useSettled(filter.query.trim().toLowerCase(), 250);
  const status = filter.status === "ALL" ? null : filter.status;
  const key = JSON.stringify([tag, filter.accountId, status, query]);
  const fetchPage = useCallback(
    (page: number) => {
      if (!source) return Promise.reject(new Error("The finance index is not reachable yet"));
      return fetchTransactions(source, { accountId: filter.accountId, status, query }, page);
    },
    [source, filter.accountId, status, query],
  );
  const list = usePagedList<TransactionRow>({
    kind: "finance-transactions",
    key,
    enabled: source !== null,
    pageSize: FINANCE_PAGE,
    fetchPage,
    refreshDebounceMs: REFRESH_DEBOUNCE_MS,
  });
  // an import, a categorise, a match: rows anywhere may have changed
  const { invalidate } = list;
  useFinanceChanges(source !== null, ACCOUNT_TYPES, invalidate);
  const counts = useIndexValue<TransactionCounts>({
    key: JSON.stringify(["transaction-counts", tag, filter.accountId]),
    enabled: source !== null,
    fetch: () =>
      source ? fetchTransactionCounts(source, filter.accountId) : Promise.reject(new Error("no source")),
    types: ACCOUNT_TYPES,
    trigger: list.version,
  });
  const patched = usePatched(list);
  return { ...patched, counts, mode };
}

/**
 * The Finances dashboard's numbers as of `now` (ms), from one index query;
 * undefined until it has answered. Month labels and the month-on-month
 * delta are the caller's: they are presentation, computed from `months`.
 */
export function useDashboardStats(drive: DocumentDriveDocument | undefined, now: number): DashboardStats | undefined {
  const { source, tag } = useFinanceSource(drive);
  // the numbers move with the minute at most; a caller passing Date.now() per render does not re-ask
  const minute = Math.floor(now / 60_000);
  const nowRef = useRef(now);
  nowRef.current = now;
  return useIndexValue<DashboardStats>({
    key: JSON.stringify(["dashboard", tag, minute]),
    enabled: source !== null,
    fetch: () => (source ? fetchDashboard(source, nowRef.current) : Promise.reject(new Error("no source"))),
    types: FINANCE_TYPES,
  });
}

/* ------------------------------------------------- claims, contacts, rest */

// The rest of the books' reads: the Expenses board, the Contacts board and
// the contact detail, the transaction detail and its match picker, the
// invoice editor's numbers and parties, the creation panels' pickers, and
// the business drive's badges. Each was a whole collection of documents
// loaded through the write store; each is now one index query.

const EXPENSE_FIELDS = `id title submitterName submitterEmail status currency total reimbursable vatTotal itemCount categories firstSpentAt submittedAt decidedAt reimbursedAt createdAt updatedAt`;
const CONTACT_FIELDS = `id name kind status email phone website vatId registrationNumber street postalCode city country paymentTermsDays defaultCategory tags openInvoiceCount openBookOutstanding transactionCount lastTransactionAt`;
const PARTY_GQL_FIELDS = PARTY_FIELDS.join(" ");

const EXPENSES_QUERY = `query ($d: String!, $s: [String!], $q: String, $o: Int, $l: Int) {
  financeIndex { expenses(driveId: $d, statuses: $s, query: $q, offset: $o, limit: $l) {
    total
    items { ${EXPENSE_FIELDS} }
  } }
}`;

const EXPENSE_COUNTS_QUERY = `query ($d: String!, $q: String) {
  financeIndex { expenseCounts(driveId: $d, query: $q) { all byStatus { status count total reimbursable } } }
}`;

const SPEND_QUERY = `query ($d: String!, $n: String) {
  financeIndex { spend90d(driveId: $d, now: $n) }
}`;

const CONTACTS_QUERY = `query ($d: String!, $v: FinanceContactView, $q: String, $o: Int, $l: Int) {
  financeIndex { contacts(driveId: $d, view: $v, query: $q, offset: $o, limit: $l) {
    total
    items { ${CONTACT_FIELDS} }
  } }
}`;

const CONTACT_COUNTS_QUERY = `query ($d: String!) {
  financeIndex { contactCounts(driveId: $d) { all customers suppliers archived } }
}`;

const CONTACT_ACTIVITY_QUERY = `query ($d: String!, $id: String!, $n: String, $il: Int, $tl: Int) {
  financeIndex {
    contact(driveId: $d, id: $id) { ${CONTACT_FIELDS} }
    invoices(driveId: $d, contactId: $id, now: $n, limit: $il) { items { ${INVOICE_FIELDS} } }
    transactions(driveId: $d, contactId: $id, limit: $tl) { items { ${TRANSACTION_FIELDS} } }
  }
}`;

const CONTACT_NAMES_QUERY = `query ($d: String!, $ids: [String!]!) {
  financeIndex { contactNames(driveId: $d, ids: $ids) { id name } }
}`;

const TRANSACTION_QUERY = `query ($d: String!, $id: String!) {
  financeIndex { transaction(driveId: $d, id: $id) { ${TRANSACTION_FIELDS} accountName accountKind matchedLabel } }
}`;

const MATCH_QUERY = `query ($d: String!, $a: Float!) {
  financeIndex { matchCandidates(driveId: $d, amount: $a) { kind id label amount distance } }
}`;

const NUMBERS_QUERY = `query ($d: String!, $dir: String!) {
  financeIndex { invoiceNumbers(driveId: $d, direction: $dir) { id number kind issuedAt } }
}`;

const NEXT_NUMBER_QUERY = `query ($d: String!, $dir: String!, $n: String, $x: String) {
  financeIndex { nextInvoiceNumber(driveId: $d, direction: $dir, now: $n, excludeId: $x) }
}`;

const OUR_PARTY_QUERY = `query ($d: String!, $dir: String!) {
  financeIndex { latestOurParty(driveId: $d, direction: $dir) { ${PARTY_GQL_FIELDS} } }
}`;

const COUNTS_QUERY = `query ($d: String!) {
  financeIndex { counts(driveId: $d) { accounts invoices expenses contacts } }
}`;

/** An expense claim as the board's card shows it (FinanceExpenseRow). */
export type ExpenseRow = ExpenseListRow;
/** A contact with its open invoices and bank activity (FinanceContactRow). */
export type ContactRow = ContactListRow;
/** One transaction with its account and what it is matched to. */
export type TransactionDetail = TransactionDetailRow;
export type {
  ContactCounts,
  ContactView,
  ExpenseCounts,
  ExpenseStatusCount,
  FinanceCounts,
  InvoiceNumberRow,
  MatchCandidate,
  OurParty,
};

/** Rows a picker or a detail asks for at once: every contact, a contact's invoices. */
const ALL_ROWS = 500;
/** The contact detail's bank activity: the latest few. */
const CONTACT_ACTIVITY_ROWS = 8;

async function fetchExpenses(
  src: Source,
  f: { statuses: readonly string[]; query: string },
  page: number,
  pageSize = FINANCE_PAGE,
): Promise<Page<ExpenseRow>> {
  const offset = page * pageSize;
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { expenses: Page<ExpenseRow> } }>(src.base, EXPENSES_QUERY, {
      d: src.driveId,
      s: f.statuses.length ? f.statuses : null,
      q: f.query || null,
      o: offset,
      l: pageSize,
    });
    return data.financeIndex.expenses;
  }
  const filter = { statuses: f.statuses, words: searchWords(f.query) };
  const [rows, count] = await Promise.all([
    expensesQuery(src.db, filter, { offset, limit: pageSize }).execute(),
    expenseCountQuery(src.db, filter).executeTakeFirst(),
  ]);
  return { items: rows.slice(0, pageSize).map(toExpenseRow), total: Number(count?.n ?? 0) };
}

async function fetchExpenseCounts(src: Source, query: string): Promise<ExpenseCounts> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { expenseCounts: ExpenseCounts } }>(src.base, EXPENSE_COUNTS_QUERY, {
      d: src.driveId,
      q: query || null,
    });
    return data.financeIndex.expenseCounts;
  }
  return toExpenseCounts(await expenseStatusQuery(src.db, searchWords(query)).execute());
}

async function fetchSpend(src: Source, nowMs: number): Promise<number> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { spend90d: number } }>(src.base, SPEND_QUERY, {
      d: src.driveId,
      n: new Date(nowMs).toISOString(),
    });
    return data.financeIndex.spend90d;
  }
  const row = await expenseSpendQuery(src.db, spendSince(nowMs)).executeTakeFirst();
  return Number(row?.spent ?? 0) || 0;
}

async function fetchContacts(
  src: Source,
  f: { view: ContactView; query: string },
  page: number,
  pageSize = FINANCE_PAGE,
): Promise<Page<ContactRow>> {
  const offset = page * pageSize;
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { contacts: Page<ContactRow> } }>(src.base, CONTACTS_QUERY, {
      d: src.driveId,
      v: f.view.toUpperCase(),
      q: f.query || null,
      o: offset,
      l: pageSize,
    });
    return data.financeIndex.contacts;
  }
  const filter = { view: f.view, words: searchWords(f.query) };
  const [rows, count] = await Promise.all([
    contactsQuery(src.db, filter, { offset, limit: pageSize }).execute(),
    contactCountQuery(src.db, filter).executeTakeFirst(),
  ]);
  return { items: rows.slice(0, pageSize).map(toContactRow), total: Number(count?.n ?? 0) };
}

async function fetchContactCounts(src: Source): Promise<ContactCounts> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { contactCounts: ContactCounts } }>(src.base, CONTACT_COUNTS_QUERY, {
      d: src.driveId,
    });
    return data.financeIndex.contactCounts;
  }
  return toContactCounts(await contactViewCountsQuery(src.db).executeTakeFirst());
}

/** A contact with the invoices that name it and its latest bank activity. */
export interface ContactActivity {
  /** Null while the index does not hold the contact yet. */
  contact: ContactRow | null;
  invoices: InvoiceRow[];
  transactions: TransactionRow[];
}

async function fetchContactActivity(src: Source, id: string, now: string): Promise<ContactActivity> {
  if (src.kind === "remote") {
    const data = await gql<{
      financeIndex: {
        contact: ContactRow | null;
        invoices: { items: InvoiceRow[] };
        transactions: { items: TransactionRow[] };
      };
    }>(src.base, CONTACT_ACTIVITY_QUERY, {
      d: src.driveId,
      id,
      n: now,
      il: ALL_ROWS,
      tl: CONTACT_ACTIVITY_ROWS,
    });
    return {
      contact: data.financeIndex.contact,
      invoices: data.financeIndex.invoices.items,
      transactions: data.financeIndex.transactions.items,
    };
  }
  const [contact, invoices, transactions] = await Promise.all([
    contactsQuery(src.db, { id }, { limit: 1 }).executeTakeFirst(),
    invoicesQuery(src.db, { contactId: id, now }, { limit: ALL_ROWS }).execute(),
    transactionsQuery(src.db, { contactId: id }, { limit: CONTACT_ACTIVITY_ROWS }).execute(),
  ]);
  return {
    contact: contact ? toContactRow(contact) : null,
    invoices: invoices.slice(0, ALL_ROWS).map((r) => toInvoiceRow(r, now)),
    transactions: transactions.slice(0, CONTACT_ACTIVITY_ROWS).map(toTransactionRow),
  };
}

async function fetchContactNames(src: Source, ids: readonly string[]): Promise<ContactName[]> {
  if (ids.length === 0) return [];
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { contactNames: ContactName[] } }>(src.base, CONTACT_NAMES_QUERY, {
      d: src.driveId,
      ids,
    });
    return data.financeIndex.contactNames;
  }
  const rows = await contactNamesQuery(src.db, ids).execute();
  return rows.map((r) => ({ id: r.document_id, name: r.name }));
}

async function fetchTransaction(src: Source, id: string): Promise<TransactionDetail | null> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { transaction: TransactionDetail | null } }>(src.base, TRANSACTION_QUERY, {
      d: src.driveId,
      id,
    });
    return data.financeIndex.transaction;
  }
  return loadTransaction(src.db, id);
}

async function fetchMatchCandidates(src: Source, amount: number): Promise<MatchCandidate[]> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { matchCandidates: MatchCandidate[] } }>(src.base, MATCH_QUERY, {
      d: src.driveId,
      a: amount,
    });
    return data.financeIndex.matchCandidates;
  }
  return loadMatchCandidates(src.db, amount);
}

async function fetchInvoiceNumbers(src: Source, direction: string): Promise<InvoiceNumberRow[]> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { invoiceNumbers: InvoiceNumberRow[] } }>(src.base, NUMBERS_QUERY, {
      d: src.driveId,
      dir: direction,
    });
    return data.financeIndex.invoiceNumbers;
  }
  return (await invoiceNumbersQuery(src.db, direction).execute()).map(toInvoiceNumberRow);
}

async function fetchNextInvoiceNumber(
  src: Source,
  direction: string,
  nowMs: number,
  excludeId: string | null,
): Promise<string> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { nextInvoiceNumber: string } }>(src.base, NEXT_NUMBER_QUERY, {
      d: src.driveId,
      dir: direction,
      n: new Date(nowMs).toISOString(),
      x: excludeId,
    });
    return data.financeIndex.nextInvoiceNumber;
  }
  const rows = await invoiceNumbersQuery(src.db, direction).execute();
  const used = rows.filter((r) => r.document_id !== excludeId).map((r) => r.number ?? "");
  return nextNumberFrom(used, direction, new Date(nowMs));
}

async function fetchLatestOurParty(src: Source, direction: string): Promise<OurParty | null> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { latestOurParty: OurParty | null } }>(src.base, OUR_PARTY_QUERY, {
      d: src.driveId,
      dir: direction,
    });
    return data.financeIndex.latestOurParty;
  }
  const row = await latestOurPartyQuery(src.db, direction).executeTakeFirst();
  return toOurParty(row?.our_party);
}

async function fetchCounts(src: Source): Promise<FinanceCounts> {
  if (src.kind === "remote") {
    const data = await gql<{ financeIndex: { counts: FinanceCounts } }>(src.base, COUNTS_QUERY, {
      d: src.driveId,
    });
    return data.financeIndex.counts;
  }
  return loadCounts(src.db);
}

const EXPENSE_TYPES = [EXPENSE_DOCUMENT_TYPE] as const;
const CONTACT_TYPES = [CONTACT_DOCUMENT_TYPE] as const;
/** A contact's aggregates move with its invoices and the accounts' transactions. */
const CONTACT_ACTIVITY_TYPES = [CONTACT_DOCUMENT_TYPE, INVOICE_DOCUMENT_TYPE, ACCOUNT_DOCUMENT_TYPE] as const;
/** A transaction's detail names its account and what it is matched to. */
const TRANSACTION_DETAIL_TYPES = [ACCOUNT_DOCUMENT_TYPE, INVOICE_DOCUMENT_TYPE, EXPENSE_DOCUMENT_TYPE] as const;
const MATCH_TYPES = [INVOICE_DOCUMENT_TYPE, EXPENSE_DOCUMENT_TYPE] as const;
const NO_EXPENSES: ExpenseRow[] = [];
const NO_CONTACTS: ContactRow[] = [];
const NO_NUMBERS: InvoiceNumberRow[] = [];
const NO_NAMES = new Map<string, string | null>();

/** Rejects: a hook asked before its source is known (it is not enabled then). */
const notYet = (): Promise<never> => Promise.reject(new Error("The finance index is not reachable yet"));

export interface ExpenseListFilter {
  /** Any of these statuses (a board column); every status when empty. */
  statuses: readonly string[];
  /** The top bar's search, raw. */
  query: string;
}

export type ExpenseList = PagedList<ExpenseRow> & { mode: "remote" | "local" | "unknown" };

/** Expense claims, the latest changed first, filtered in the index and paged where the reader is. */
export function useExpenseList(filter: ExpenseListFilter, drive?: DocumentDriveDocument): ExpenseList {
  const sektar = useSektarDrive();
  const { source, tag, mode } = useFinanceSource(drive ?? sektar);
  const query = useSettled(filter.query.trim().toLowerCase(), 250);
  const statuses = filter.statuses.join(",");
  const key = JSON.stringify([tag, statuses, query]);
  const fetchPage = useCallback(
    (page: number) =>
      source
        ? fetchExpenses(source, { statuses: statuses ? statuses.split(",") : [], query }, page)
        : notYet(),
    [source, statuses, query],
  );
  const list = usePagedList<ExpenseRow>({
    kind: "finance-expenses",
    key,
    enabled: source !== null,
    pageSize: FINANCE_PAGE,
    fetchPage,
    refreshDebounceMs: REFRESH_DEBOUNCE_MS,
  });
  // a claim submitted or approved moves between columns
  const { invalidate } = list;
  useFinanceChanges(source !== null, EXPENSE_TYPES, invalidate);
  return { ...list, mode };
}

/** Claims per status with their totals, for the search given; undefined until the index has answered. */
export function useExpenseCounts(query: string, drive?: DocumentDriveDocument): ExpenseCounts | undefined {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  const settled = useSettled(query.trim().toLowerCase(), 250);
  return useIndexValue<ExpenseCounts>({
    key: JSON.stringify(["expense-counts", tag, settled]),
    enabled: source !== null,
    fetch: () => (source ? fetchExpenseCounts(source, settled) : notYet()),
    types: EXPENSE_TYPES,
  });
}

/** Receipts spent in the 90 days before `now` (ms), added up; undefined until the index has answered. */
export function useExpenseSpend(now: number, drive?: DocumentDriveDocument): number | undefined {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  const day = new Date(now).toISOString().slice(0, 10);
  const nowRef = useRef(now);
  nowRef.current = now;
  return useIndexValue<number>({
    key: JSON.stringify(["expense-spend", tag, day]),
    enabled: source !== null,
    fetch: () => (source ? fetchSpend(source, nowRef.current) : notYet()),
    types: EXPENSE_TYPES,
  });
}

/** Claims awaiting approval, the latest changed first: the dashboard's "needs attention". */
export function useAwaitingClaims(drive?: DocumentDriveDocument): ExpenseRow[] {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  const page = useIndexValue<Page<ExpenseRow>>({
    key: JSON.stringify(["expense-awaiting", tag]),
    enabled: source !== null,
    fetch: () => (source ? fetchExpenses(source, { statuses: ["SUBMITTED"], query: "" }, 0) : notYet()),
    types: EXPENSE_TYPES,
  });
  return page?.items ?? NO_EXPENSES;
}

export interface ContactListFilter {
  view: ContactView;
  /** The top bar's search, raw. */
  query: string;
}

export type ContactList = PagedList<ContactRow> & { mode: "remote" | "local" | "unknown" };

/** The Contacts board: by name, with each contact's open invoices and bank activity, paged where the reader is. */
export function useContactList(filter: ContactListFilter, drive?: DocumentDriveDocument): ContactList {
  const sektar = useSektarDrive();
  const { source, tag, mode } = useFinanceSource(drive ?? sektar);
  const query = useSettled(filter.query.trim().toLowerCase(), 250);
  const key = JSON.stringify([tag, filter.view, query]);
  const fetchPage = useCallback(
    (page: number) => (source ? fetchContacts(source, { view: filter.view, query }, page) : notYet()),
    [source, filter.view, query],
  );
  const list = usePagedList<ContactRow>({
    kind: "finance-contacts",
    key,
    enabled: source !== null,
    pageSize: FINANCE_PAGE,
    fetchPage,
    refreshDebounceMs: REFRESH_DEBOUNCE_MS,
  });
  // a rename moves a row; an invoice or a categorise changes the aggregates
  const { invalidate } = list;
  useFinanceChanges(source !== null, CONTACT_ACTIVITY_TYPES, invalidate);
  return { ...list, mode };
}

/** The Contacts board's filter counts; undefined until the index has answered. */
export function useContactCounts(drive?: DocumentDriveDocument): ContactCounts | undefined {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  return useIndexValue<ContactCounts>({
    key: JSON.stringify(["contact-counts", tag]),
    enabled: source !== null,
    fetch: () => (source ? fetchContactCounts(source) : notYet()),
    types: CONTACT_TYPES,
  });
}

/**
 * Every active contact by name, for a picker (a transaction's contact, an
 * invoice's party, a new invoice's customer); empty until the index has
 * answered.
 */
export function useContactOptions(drive?: DocumentDriveDocument): ContactRow[] {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  const page = useIndexValue<Page<ContactRow>>({
    key: JSON.stringify(["contact-options", tag]),
    enabled: source !== null,
    fetch: () => (source ? fetchContacts(source, { view: "all", query: "" }, 0, ALL_ROWS) : notYet()),
    types: CONTACT_TYPES,
  });
  return page?.items ?? NO_CONTACTS;
}

/** A contact's aggregates, the invoices that name it and its latest bank activity; undefined until answered. */
export function useContactActivity(
  contactId: string | null | undefined,
  drive?: DocumentDriveDocument,
): ContactActivity | undefined {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  // overdue is measured at the day's start of asking; a new day asks again
  const day = new Date().toISOString().slice(0, 10);
  return useIndexValue<ContactActivity>({
    key: JSON.stringify(["contact-activity", tag, contactId ?? "", day]),
    enabled: source !== null && !!contactId,
    fetch: () => (source && contactId ? fetchContactActivity(source, contactId, isoNow(Date.now())) : notYet()),
    types: CONTACT_ACTIVITY_TYPES,
  });
}

/** The names of the contacts asked for, by id (absent until the index has answered). */
export function useContactNames(
  ids: readonly string[],
  drive?: DocumentDriveDocument,
): ReadonlyMap<string, string | null> {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  const wanted = [...new Set(ids)].sort().join(",");
  const names = useIndexValue<ContactName[]>({
    key: JSON.stringify(["contact-names", tag, wanted]),
    enabled: source !== null && wanted !== "",
    fetch: () => (source ? fetchContactNames(source, wanted.split(",")) : notYet()),
    types: CONTACT_TYPES,
  });
  return useMemo(
    () => (names ? new Map(names.map((c) => [c.id, c.name])) : NO_NAMES),
    [names],
  );
}

/**
 * One transaction for its detail: the index row with its account and what
 * it is matched to. `row` is undefined while asked, null when the index
 * does not hold it. `patch` shows a change this tab made until the index
 * agrees (or a while has passed).
 */
export function useTransactionDetail(
  id: string | null | undefined,
  drive?: DocumentDriveDocument,
): {
  row: TransactionDetail | null | undefined;
  patch: (change: Partial<TransactionDetail>) => void;
} {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  const [overlay, setOverlay] = useState<{ id: string; change: Partial<TransactionDetail>; at: number } | null>(null);
  const fetched = useIndexValue<TransactionDetail | null>({
    key: JSON.stringify(["transaction", tag, id ?? ""]),
    enabled: source !== null && !!id,
    fetch: () => (source && id ? fetchTransaction(source, id) : notYet()),
    types: TRANSACTION_DETAIL_TYPES,
    trigger: overlay?.at,
  });
  const patch = useCallback(
    (change: Partial<TransactionDetail>) => {
      if (!id) return;
      setOverlay((prev) => ({
        id,
        change: { ...(prev?.id === id ? prev.change : {}), ...change },
        at: Date.now(),
      }));
    },
    [id],
  );
  // the patch has had its time: the index row stands on its own
  useEffect(() => {
    if (!overlay) return;
    const timer = setTimeout(() => setOverlay(null), PATCH_TTL_MS);
    return () => clearTimeout(timer);
  }, [overlay]);
  const row = useMemo((): TransactionDetail | null | undefined => {
    if (!id || fetched === undefined) return undefined;
    if (fetched === null) return null;
    // the previous transaction's answer, kept while this one is asked
    if (fetched.id !== id) return undefined;
    if (!overlay || overlay.id !== id) return fetched;
    const fields = Object.keys(overlay.change) as (keyof TransactionDetail)[];
    if (fields.every((k) => fetched[k] === overlay.change[k])) return fetched;
    return { ...fetched, ...overlay.change };
  }, [fetched, overlay, id]);
  return { row, patch };
}

/** What a transaction of `amount` could settle, closest first; undefined until answered. */
export function useMatchCandidates(
  amount: number | null,
  drive?: DocumentDriveDocument,
): MatchCandidate[] | undefined {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  return useIndexValue<MatchCandidate[]>({
    key: JSON.stringify(["match-candidates", tag, amount]),
    enabled: source !== null && amount !== null,
    fetch: () => (source && amount !== null ? fetchMatchCandidates(source, amount) : notYet()),
    types: MATCH_TYPES,
  });
}

/** Every numbered invoice in a direction, highest first; empty until the index has answered. */
export function useInvoiceNumbers(direction: string, drive?: DocumentDriveDocument): InvoiceNumberRow[] {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  const rows = useIndexValue<InvoiceNumberRow[]>({
    key: JSON.stringify(["invoice-numbers", tag, direction]),
    enabled: source !== null,
    fetch: () => (source ? fetchInvoiceNumbers(source, direction) : notYet()),
    types: INVOICE_TYPES,
  });
  return rows ?? NO_NUMBERS;
}

/** The next number in a direction's sequence, leaving `excludeId` out; undefined until answered. */
export function useNextInvoiceNumber(
  direction: string,
  excludeId: string | null,
  drive?: DocumentDriveDocument,
): string | undefined {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  const year = new Date().getUTCFullYear();
  return useIndexValue<string>({
    key: JSON.stringify(["next-number", tag, direction, excludeId, year]),
    enabled: source !== null,
    fetch: () => (source ? fetchNextInvoiceNumber(source, direction, Date.now(), excludeId) : notYet()),
    types: INVOICE_TYPES,
  });
}

/**
 * Our details as the latest invoice in that direction has them (there is no
 * company profile yet); null when no invoice names them, undefined until
 * the index has answered.
 */
export function useLatestOurParty(direction: string, drive?: DocumentDriveDocument): OurParty | null | undefined {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  return useIndexValue<OurParty | null>({
    key: JSON.stringify(["our-party", tag, direction]),
    enabled: source !== null,
    fetch: () => (source ? fetchLatestOurParty(source, direction) : notYet()),
    types: INVOICE_TYPES,
  });
}

/** How many accounts, invoices, claims and contacts the books hold; undefined until answered. */
export function useFinanceCounts(drive?: DocumentDriveDocument): FinanceCounts | undefined {
  const sektar = useSektarDrive();
  const { source, tag } = useFinanceSource(drive ?? sektar);
  return useIndexValue<FinanceCounts>({
    key: JSON.stringify(["counts", tag]),
    enabled: source !== null,
    fetch: () => (source ? fetchCounts(source) : notYet()),
    types: FINANCE_DOCUMENT_TYPES,
  });
}

/** A contact as an invoice party, from its index row: the fields an invoice copies (`partyFromContact`). */
export function partyFromContactRow(c: ContactRow): SetBuyerInput {
  return {
    name: c.name,
    contactId: c.id,
    email: c.email,
    phone: c.phone,
    vatId: c.vatId,
    registrationId: c.registrationNumber,
    street: c.street,
    postalCode: c.postalCode,
    city: c.city,
    country: c.country,
  };
}

export function contactKindOf(value: string): ContactKind {
  return value in CONTACT_KIND ? (value as ContactKind) : "OTHER";
}

export function expenseStatusOf(value: string): ExpenseStatus {
  return value in EXPENSE_STATUS ? (value as ExpenseStatus) : "DRAFT";
}
