// Reading the finance boards through the finance index rather than their
// documents (processors/finance-index).
//
// The Finances dashboard, the Invoices list and the Transactions table show
// rows and sums. Loading every account document (each carries every
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
import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import type {
  AccountKind,
  TransactionCategory,
  TransactionStatus,
} from "document-models/bank-account";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ACCOUNT_DOCUMENT_TYPE,
  accountsQuery,
  FINANCE_PAGE,
  FinanceIndex,
  INVOICE_DOCUMENT_TYPE,
  INVOICE_VIEWS,
  invoiceCountQuery,
  invoicesQuery,
  invoiceViewCountsQuery,
  isoNow,
  loadDashboard,
  searchWords,
  toAccountRow,
  toInvoiceCounts,
  toInvoiceRow,
  toTransactionCounts,
  toTransactionRow,
  transactionCountQuery,
  transactionCountsQuery,
  transactionsQuery,
  type AccountListRow,
  type DashboardMonth,
  type DashboardSpend,
  type DashboardStats,
  type DB,
  type FinanceQueryBuilder,
  type InvoiceCounts,
  type InvoiceListRow,
  type InvoiceView,
  type TransactionCounts,
  type TransactionListRow,
  type ViewCount,
} from "../../../processors/finance-index/index.js";
import { useSektarDrive } from "./data.js";
import { ACCOUNT_KIND, CATEGORY, TX_STATUS } from "./format.js";
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

async function gql<T>(base: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${base}/graphql`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error(`The index answered ${response.status}`);
  return json.data;
}

/* ---------------------------------------------------------------- wire */

const INVOICE_FIELDS = `id direction kind status number counterpartyName counterpartyContactId subject firstLine currency issuedAt dueAt deliveredAt periodStart periodEnd createdAt gross outstanding bookGross bookOutstanding bookRateKnown overdue issuedCopyId issuedCopyRef lineCount linesMissingAttachments lastPaidAt updatedAt`;
const ACCOUNT_FIELDS = `id name kind institution ibanLast4 currency openingBalance balance txCount newCount lastImportedAt updatedAt`;
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
  financeIndex { transactionCounts(driveId: $d, accountId: $a) { all new categorised matched excluded } }
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
