/**
 * Reading the finance index.
 *
 * Read-only by design: the index says what the books hold, never changes
 * them. Issuing, paying and categorising go through the documents, and the
 * processor brings the index up to date behind them.
 *
 * Access: an invoice row and an account row are one document each
 * (`document_id`); a transaction row derives from its bank account document
 * (`account_id`). Every query, the counts and the dashboard included, is
 * filtered through the host's readable documents read model for the caller
 * once the drive passed (`indexAccess`), so a total never counts a document
 * the caller could not open.
 */
import {
  applyReadableFilter,
  type BaseSubgraph,
  type Context,
  type ReadableFilter,
} from "@powerhousedao/reactor-api";
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

const EMPTY_PAGE = { items: [], total: 0, hasMore: false };

export const getResolvers = (
  subgraph: BaseSubgraph,
): Record<string, unknown> => {
  const db = (driveId: string) =>
    FinanceIndex.query(driveId, subgraph.relationalDb);
  /** The row filter for the caller, or null when the drive refuses them. */
  const accessTo = async (
    ctx: Context,
    driveId: string,
  ): Promise<ReadableFilter | null> => {
    const access = await subgraph.indexAccess(ctx, driveId);
    return access.kind === "none" ? null : access;
  };

  async function invoices(
    ctx: Context,
    args: InvoicesArgs,
  ): Promise<InvoicePageResult> {
    const access = await accessTo(ctx, args.driveId);
    if (!access) return EMPTY_PAGE;
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
      applyReadableFilter(
        invoicesQuery(q, filter, { offset: pageOffset(args.offset), limit }),
        "document_id",
        access,
      ).execute(),
      applyReadableFilter(
        invoiceCountQuery(q, filter),
        "document_id",
        access,
      ).executeTakeFirst(),
    ]);
    const hasMore = rows.length > limit;
    return {
      items: (hasMore ? rows.slice(0, limit) : rows).map((r) =>
        toInvoiceRow(r, now),
      ),
      total: Number(count?.n ?? 0),
      hasMore,
    };
  }

  async function invoiceCounts(
    ctx: Context,
    driveId: string,
    now?: string | null,
  ): Promise<InvoiceCounts> {
    const access = await accessTo(ctx, driveId);
    if (!access) return toInvoiceCounts([]);
    const rows = await applyReadableFilter(
      invoiceViewCountsQuery(db(driveId), isoNow(now)),
      "document_id",
      access,
    ).execute();
    return toInvoiceCounts(rows);
  }

  async function accounts(
    ctx: Context,
    driveId: string,
  ): Promise<AccountListRow[]> {
    const access = await accessTo(ctx, driveId);
    if (!access) return [];
    const rows = await applyReadableFilter(
      accountsQuery(db(driveId)),
      "document_id",
      access,
    ).execute();
    return rows.map(toAccountRow);
  }

  async function transactions(
    ctx: Context,
    args: TransactionsArgs,
  ): Promise<TransactionPageResult> {
    const access = await accessTo(ctx, args.driveId);
    if (!access) return EMPTY_PAGE;
    const filter = {
      accountId: args.accountId ?? null,
      status: args.status ?? null,
      category: args.category ?? null,
      words: searchWords(args.query),
    };
    const limit = pageLimit(args.limit);
    const q = db(args.driveId);
    const [rows, count] = await Promise.all([
      applyReadableFilter(
        transactionsQuery(q, filter, {
          offset: pageOffset(args.offset),
          limit,
        }),
        "account_id",
        access,
      ).execute(),
      applyReadableFilter(
        transactionCountQuery(q, filter),
        "account_id",
        access,
      ).executeTakeFirst(),
    ]);
    const hasMore = rows.length > limit;
    return {
      items: (hasMore ? rows.slice(0, limit) : rows).map(toTransactionRow),
      total: Number(count?.n ?? 0),
      hasMore,
    };
  }

  async function transactionCounts(
    ctx: Context,
    driveId: string,
    accountId?: string | null,
  ): Promise<TransactionCounts> {
    const access = await accessTo(ctx, driveId);
    if (!access) return toTransactionCounts(undefined);
    const row = await applyReadableFilter(
      transactionCountsQuery(db(driveId), accountId),
      "account_id",
      access,
    ).executeTakeFirst();
    return toTransactionCounts(row);
  }

  async function dashboard(
    ctx: Context,
    driveId: string,
    now: string,
  ): Promise<DashboardStats> {
    const access = (await accessTo(ctx, driveId)) ?? { kind: "none" as const };
    return loadDashboard(db(driveId), Date.parse(isoNow(now)), (q, column) =>
      applyReadableFilter(q, column, access),
    );
  }

  return {
    Query: {
      financeIndex: () => ({}),
    },
    FinanceIndexQueries: {
      invoices: (_parent: unknown, args: InvoicesArgs, ctx: Context) =>
        invoices(ctx, args),
      invoiceCounts: (
        _parent: unknown,
        args: { driveId: string; now?: string | null },
        ctx: Context,
      ) => invoiceCounts(ctx, args.driveId, args.now),
      accounts: (_parent: unknown, args: { driveId: string }, ctx: Context) =>
        accounts(ctx, args.driveId),
      transactions: (_parent: unknown, args: TransactionsArgs, ctx: Context) =>
        transactions(ctx, args),
      transactionCounts: (
        _parent: unknown,
        args: { driveId: string; accountId?: string | null },
        ctx: Context,
      ) => transactionCounts(ctx, args.driveId, args.accountId),
      dashboard: (
        _parent: unknown,
        args: { driveId: string; now: string },
        ctx: Context,
      ) => dashboard(ctx, args.driveId, args.now),
    },
    FinanceViewCount: {
      view: (parent: { view: InvoiceView }) => toEnumView(parent.view),
    },
  };
};
