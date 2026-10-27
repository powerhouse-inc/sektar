/**
 * Reading the finance index.
 *
 * Read-only by design: the index says what the books hold, never changes
 * them. Issuing, paying and categorising go through the documents, and the
 * processor brings the index up to date behind them.
 *
 * Access is declared in index.ts and applied by the subgraph wrapper: every
 * query goes through `restrict`; the dashboard names each of its queries'
 * document column itself.
 */
import type { IndexQuery } from "@powerhousedao/reactor-api";
import {
  accountsQuery,
  FINANCE_PAGE,
  FINANCE_PAGE_MAX,
  type FinanceIndex,
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

type Db = FinanceIndex["query"];

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

async function invoices({
  db,
  args,
  restrict,
}: IndexQuery<Db, InvoicesArgs>): Promise<InvoicePageResult> {
  const view = (args.view ?? "all").toLowerCase();
  const now = isoNow(args.now);
  const filter = {
    direction: args.direction ?? null,
    view: isView(view) ? view : ("all" as const),
    words: searchWords(args.query),
    now,
  };
  const limit = pageLimit(args.limit);
  const [rows, count] = await Promise.all([
    restrict(
      invoicesQuery(db, filter, { offset: pageOffset(args.offset), limit }),
    ).execute(),
    restrict(invoiceCountQuery(db, filter)).executeTakeFirst(),
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

async function invoiceCounts({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  { driveId: string; now?: string | null }
>): Promise<InvoiceCounts> {
  const rows = await restrict(
    invoiceViewCountsQuery(db, isoNow(args.now)),
  ).execute();
  return toInvoiceCounts(rows);
}

async function accounts({
  db,
  restrict,
}: IndexQuery<Db, { driveId: string }>): Promise<AccountListRow[]> {
  const rows = await restrict(accountsQuery(db)).execute();
  return rows.map(toAccountRow);
}

async function transactions({
  db,
  args,
  restrict,
}: IndexQuery<Db, TransactionsArgs>): Promise<TransactionPageResult> {
  const filter = {
    accountId: args.accountId ?? null,
    status: args.status ?? null,
    category: args.category ?? null,
    words: searchWords(args.query),
  };
  const limit = pageLimit(args.limit);
  const [rows, count] = await Promise.all([
    restrict(
      transactionsQuery(db, filter, { offset: pageOffset(args.offset), limit }),
    ).execute(),
    restrict(transactionCountQuery(db, filter)).executeTakeFirst(),
  ]);
  const hasMore = rows.length > limit;
  return {
    items: (hasMore ? rows.slice(0, limit) : rows).map(toTransactionRow),
    total: Number(count?.n ?? 0),
    hasMore,
  };
}

async function transactionCounts({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  { driveId: string; accountId?: string | null }
>): Promise<TransactionCounts> {
  const row = await restrict(
    transactionCountsQuery(db, args.accountId),
  ).executeTakeFirst();
  return toTransactionCounts(row);
}

function dashboard({
  db,
  args,
  restrict,
}: IndexQuery<Db, { driveId: string; now: string }>): Promise<DashboardStats> {
  return loadDashboard(db, Date.parse(isoNow(args.now)), (q, column) =>
    restrict(q, column),
  );
}

export const resolvers = {
  Query: {
    financeIndex: () => ({}),
  },
  FinanceViewCount: {
    view: (parent: { view: InvoiceView }) => toEnumView(parent.view),
  },
};

export const queries = {
  "FinanceIndexQueries.invoices": invoices,
  "FinanceIndexQueries.invoiceCounts": invoiceCounts,
  "FinanceIndexQueries.accounts": accounts,
  "FinanceIndexQueries.transactions": transactions,
  "FinanceIndexQueries.transactionCounts": transactionCounts,
  "FinanceIndexQueries.dashboard": dashboard,
};
