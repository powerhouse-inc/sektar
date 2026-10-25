/**
 * Reading the finance index.
 *
 * Read-only by design: the index says what the books hold, never changes
 * them. Issuing, paying and categorising go through the documents, and the
 * processor brings the index up to date behind them.
 */
import { type BaseSubgraph } from "@powerhousedao/reactor-api";
import {
  accountsQuery,
  FINANCE_PAGE,
  FINANCE_PAGE_MAX,
  FinanceIndex,
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
  type DashboardStats,
  type InvoiceCounts,
  type InvoicePageResult,
  type InvoiceView,
  type TransactionCounts,
  type TransactionPageResult,
} from "processors/finance-index";

interface InvoicesArgs {
  driveId: string;
  direction?: string | null;
  view?: string | null;
  query?: string | null;
  now?: string | null;
  offset?: number | null;
  limit?: number | null;
}

interface TransactionsArgs {
  driveId: string;
  accountId?: string | null;
  status?: string | null;
  category?: string | null;
  query?: string | null;
  offset?: number | null;
  limit?: number | null;
}

const isView = (v: string): v is InvoiceView =>
  (INVOICE_VIEWS as readonly string[]).includes(v);

const pageLimit = (limit: number | null | undefined) =>
  Math.min(Math.max(limit ?? FINANCE_PAGE, 1), FINANCE_PAGE_MAX);

const pageOffset = (offset: number | null | undefined) =>
  Math.max(0, Math.floor(offset ?? 0));

/** GraphQL enum values are upper case; the queries' views are lower. */
const toEnumView = (view: InvoiceView) => view.toUpperCase();

export const getResolvers = (
  subgraph: BaseSubgraph,
): Record<string, unknown> => {
  const db = (driveId: string) =>
    FinanceIndex.query(driveId, subgraph.relationalDb);

  async function invoices(args: InvoicesArgs): Promise<InvoicePageResult> {
    const view = (args.view ?? "all").toLowerCase();
    const now = isoNow(args.now);
    const filter = {
      direction: args.direction ?? null,
      view: isView(view) ? view : ("all" as const),
      words: searchWords(args.query),
      now,
    };
    const limit = pageLimit(args.limit);
    const q = db(args.driveId);
    const [rows, count] = await Promise.all([
      invoicesQuery(q, filter, { offset: pageOffset(args.offset), limit }).execute(),
      invoiceCountQuery(q, filter).executeTakeFirst(),
    ]);
    const hasMore = rows.length > limit;
    return {
      items: (hasMore ? rows.slice(0, limit) : rows).map((r) => toInvoiceRow(r, now)),
      total: Number(count?.n ?? 0),
      hasMore,
    };
  }

  async function invoiceCounts(driveId: string, now?: string | null): Promise<InvoiceCounts> {
    const rows = await invoiceViewCountsQuery(db(driveId), isoNow(now)).execute();
    return toInvoiceCounts(rows);
  }

  async function accounts(driveId: string): Promise<AccountListRow[]> {
    const rows = await accountsQuery(db(driveId)).execute();
    return rows.map(toAccountRow);
  }

  async function transactions(args: TransactionsArgs): Promise<TransactionPageResult> {
    const filter = {
      accountId: args.accountId ?? null,
      status: args.status ?? null,
      category: args.category ?? null,
      words: searchWords(args.query),
    };
    const limit = pageLimit(args.limit);
    const q = db(args.driveId);
    const [rows, count] = await Promise.all([
      transactionsQuery(q, filter, { offset: pageOffset(args.offset), limit }).execute(),
      transactionCountQuery(q, filter).executeTakeFirst(),
    ]);
    const hasMore = rows.length > limit;
    return {
      items: (hasMore ? rows.slice(0, limit) : rows).map(toTransactionRow),
      total: Number(count?.n ?? 0),
      hasMore,
    };
  }

  async function transactionCounts(
    driveId: string,
    accountId?: string | null,
  ): Promise<TransactionCounts> {
    const row = await transactionCountsQuery(db(driveId), accountId).executeTakeFirst();
    return toTransactionCounts(row);
  }

  async function dashboard(driveId: string, now: string): Promise<DashboardStats> {
    return loadDashboard(db(driveId), Date.parse(isoNow(now)));
  }

  return {
    Query: {
      financeIndex: () => ({}),
    },
    FinanceIndexQueries: {
      invoices: (_parent: unknown, args: InvoicesArgs) => invoices(args),
      invoiceCounts: (_parent: unknown, args: { driveId: string; now?: string | null }) =>
        invoiceCounts(args.driveId, args.now),
      accounts: (_parent: unknown, args: { driveId: string }) => accounts(args.driveId),
      transactions: (_parent: unknown, args: TransactionsArgs) => transactions(args),
      transactionCounts: (
        _parent: unknown,
        args: { driveId: string; accountId?: string | null },
      ) => transactionCounts(args.driveId, args.accountId),
      dashboard: (_parent: unknown, args: { driveId: string; now: string }) =>
        dashboard(args.driveId, args.now),
    },
    FinanceViewCount: {
      view: (parent: { view: InvoiceView }) => toEnumView(parent.view),
    },
  };
};
