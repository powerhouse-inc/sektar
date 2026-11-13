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
  CONTACT_VIEWS,
  contactCountQuery,
  contactNamesQuery,
  contactsQuery,
  contactViewCountsQuery,
  expenseCountQuery,
  expenseSpendQuery,
  expensesQuery,
  expenseStatusQuery,
  FINANCE_PAGE,
  FINANCE_PAGE_MAX,
  type FinanceIndex,
  INVOICE_VIEWS,
  invoiceCountQuery,
  invoicesQuery,
  invoiceViewCountsQuery,
  invoiceNumbersQuery,
  isoNow,
  latestOurPartyQuery,
  loadCounts,
  loadClosingRates,
  loadCurrenciesInUse,
  loadDashboard,
  loadFx,
  loadMatchCandidates,
  loadOpenByContact,
  loadPairs,
  loadSettings,
  loadTransaction,
  nextNumberFrom,
  searchWords,
  spendSince,
  toAccountRow,
  toContactCounts,
  toContactRow,
  toExpenseCounts,
  toExpenseRow,
  toExpenseSpend,
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
  type ContactPageResult,
  type ContactView,
  type CurrencyInUse,
  type CurrencyPairRow,
  type DashboardStats,
  type ExpenseCounts,
  type ExpensePageResult,
  type FinanceClosingRates,
  type FinanceCounts,
  type FinanceSettings,
  type InvoiceCounts,
  type InvoiceNumberRow,
  type InvoicePageResult,
  type InvoiceView,
  type MatchCandidate,
  type OurParty,
  type TransactionCounts,
  type TransactionDetailRow,
  type TransactionPageResult,
} from "processors/finance-index";

type Db = FinanceIndex["query"];

interface InvoicesArgs {
  driveId: string;
  direction?: string | null;
  view?: string | null;
  query?: string | null;
  now?: string | null;
  contactId?: string | null;
  offset?: number | null;
  limit?: number | null;
}

interface TransactionsArgs {
  driveId: string;
  accountId?: string | null;
  status?: string | null;
  category?: string | null;
  query?: string | null;
  contactId?: string | null;
  offset?: number | null;
  limit?: number | null;
}

interface ExpensesArgs {
  driveId: string;
  statuses?: string[] | null;
  query?: string | null;
  offset?: number | null;
  limit?: number | null;
}

interface ContactsArgs {
  driveId: string;
  view?: string | null;
  query?: string | null;
  offset?: number | null;
  limit?: number | null;
}

const isView = (v: string): v is InvoiceView =>
  (INVOICE_VIEWS as readonly string[]).includes(v);

const isContactView = (v: string): v is ContactView =>
  (CONTACT_VIEWS as readonly string[]).includes(v);

const pageLimit = (limit: number | null | undefined) =>
  Math.min(Math.max(limit ?? FINANCE_PAGE, 1), FINANCE_PAGE_MAX);

const pageOffset = (offset: number | null | undefined) =>
  Math.max(0, Math.floor(offset ?? 0));

/** GraphQL enum values are upper case; the queries' views are lower. */
const toEnumView = (view: InvoiceView) => view.toUpperCase();

/** What the contacts' open invoices still owe, in the main currency. */
async function openByContact(
  db: Db,
  ids: string[],
  restrict: Parameters<typeof loadOpenByContact>[3],
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  return loadOpenByContact(db, ids, await loadFx(db, restrict), restrict);
}

function settings({
  db,
  restrict,
}: IndexQuery<Db, { driveId: string }>): Promise<FinanceSettings> {
  return loadSettings(db, (q, column) => restrict(q, column));
}

function closingRates({
  db,
  restrict,
}: IndexQuery<Db, { driveId: string }>): Promise<FinanceClosingRates> {
  return loadClosingRates(db, (q, column) => restrict(q, column));
}

function pairs({
  db,
  restrict,
}: IndexQuery<Db, { driveId: string }>): Promise<CurrencyPairRow[]> {
  return loadPairs(db, (q, column) => restrict(q, column));
}

function currenciesInUse({
  db,
  restrict,
}: IndexQuery<Db, { driveId: string }>): Promise<CurrencyInUse[]> {
  return loadCurrenciesInUse(db, (q, column) => restrict(q, column));
}

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
    contactId: args.contactId ?? null,
  };
  const limit = pageLimit(args.limit);
  const [rows, count, fx] = await Promise.all([
    restrict(
      invoicesQuery(db, filter, { offset: pageOffset(args.offset), limit }),
    ).execute(),
    restrict(invoiceCountQuery(db, filter)).executeTakeFirst(),
    loadFx(db, (q, column) => restrict(q, column)),
  ]);
  const hasMore = rows.length > limit;
  return {
    items: (hasMore ? rows.slice(0, limit) : rows).map((r) =>
      toInvoiceRow(r, now, fx),
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
    contactId: args.contactId ?? null,
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

async function invoiceNumbers({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  { driveId: string; direction: string }
>): Promise<InvoiceNumberRow[]> {
  const rows = await restrict(
    invoiceNumbersQuery(db, args.direction),
  ).execute();
  return rows.map(toInvoiceNumberRow);
}

async function nextInvoiceNumber({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  {
    driveId: string;
    direction: string;
    now?: string | null;
    excludeId?: string | null;
  }
>): Promise<string> {
  const rows = await restrict(
    invoiceNumbersQuery(db, args.direction),
  ).execute();
  const used = rows
    .filter((r) => r.document_id !== args.excludeId)
    .map((r) => r.number ?? "");
  return nextNumberFrom(used, args.direction, new Date(isoNow(args.now)));
}

async function latestOurParty({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  { driveId: string; direction: string }
>): Promise<OurParty | null> {
  const row = await restrict(
    latestOurPartyQuery(db, args.direction),
  ).executeTakeFirst();
  return toOurParty(row?.our_party);
}

async function expenses({
  db,
  args,
  restrict,
}: IndexQuery<Db, ExpensesArgs>): Promise<ExpensePageResult> {
  const filter = {
    statuses: args.statuses ?? null,
    words: searchWords(args.query),
  };
  const limit = pageLimit(args.limit);
  const [rows, count] = await Promise.all([
    restrict(
      expensesQuery(db, filter, { offset: pageOffset(args.offset), limit }),
    ).execute(),
    restrict(expenseCountQuery(db, filter)).executeTakeFirst(),
  ]);
  const hasMore = rows.length > limit;
  return {
    items: (hasMore ? rows.slice(0, limit) : rows).map(toExpenseRow),
    total: Number(count?.n ?? 0),
    hasMore,
  };
}

async function expenseCounts({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  { driveId: string; query?: string | null }
>): Promise<ExpenseCounts> {
  const [rows, fx] = await Promise.all([
    restrict(expenseStatusQuery(db, searchWords(args.query))).execute(),
    loadFx(db, (q, column) => restrict(q, column)),
  ]);
  return toExpenseCounts(rows, fx);
}

async function spend90d({
  db,
  args,
  restrict,
}: IndexQuery<Db, { driveId: string; now?: string | null }>): Promise<number> {
  const since = spendSince(Date.parse(isoNow(args.now)));
  const [rows, fx] = await Promise.all([
    restrict(expenseSpendQuery(db, since)).execute(),
    loadFx(db, (q, column) => restrict(q, column)),
  ]);
  return toExpenseSpend(rows, fx);
}

async function contacts({
  db,
  args,
  restrict,
}: IndexQuery<Db, ContactsArgs>): Promise<ContactPageResult> {
  const view = (args.view ?? "all").toLowerCase();
  const filter = {
    view: isContactView(view) ? view : ("all" as const),
    words: searchWords(args.query),
  };
  const limit = pageLimit(args.limit);
  const [rows, count] = await Promise.all([
    restrict(
      // The aggregates are narrowed inside the query, each on its own column.
      contactsQuery(
        db,
        filter,
        { offset: pageOffset(args.offset), limit },
        (q, column) => restrict(q, column),
      ),
    ).execute(),
    restrict(contactCountQuery(db, filter)).executeTakeFirst(),
  ]);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const open = await openByContact(
    db,
    page.map((r) => r.document_id),
    (q, column) => restrict(q, column),
  );
  return {
    items: page.map((r) => toContactRow(r, open)),
    total: Number(count?.n ?? 0),
    hasMore,
  };
}

async function contactCounts({
  db,
  restrict,
}: IndexQuery<Db, { driveId: string }>): Promise<ContactCounts> {
  const row = await restrict(
    contactViewCountsQuery(db),
    "document_id",
  ).executeTakeFirst();
  return toContactCounts(row);
}

async function contact({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  { driveId: string; id: string }
>): Promise<ContactListRow | null> {
  const row = await restrict(
    contactsQuery(db, { id: args.id }, { limit: 1 }, (q, column) =>
      restrict(q, column),
    ),
  ).executeTakeFirst();
  if (!row) return null;
  const open = await openByContact(db, [row.document_id], (q, column) =>
    restrict(q, column),
  );
  return toContactRow(row, open);
}

async function contactNames({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  { driveId: string; ids: string[] }
>): Promise<ContactName[]> {
  const rows = await restrict(
    contactNamesQuery(db, args.ids.slice(0, FINANCE_PAGE_MAX)),
  ).execute();
  return rows.map((r) => ({ id: r.document_id, name: r.name }));
}

function transaction({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  { driveId: string; id: string }
>): Promise<TransactionDetailRow | null> {
  return loadTransaction(db, args.id, (q, column) => restrict(q, column));
}

function matchCandidates({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  { driveId: string; amount: number }
>): Promise<MatchCandidate[]> {
  return loadMatchCandidates(db, args.amount, (q, column) =>
    restrict(q, column),
  );
}

function counts({
  db,
  restrict,
}: IndexQuery<Db, { driveId: string }>): Promise<FinanceCounts> {
  return loadCounts(db, (q, column) => restrict(q, column));
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
  "FinanceIndexQueries.invoiceNumbers": invoiceNumbers,
  "FinanceIndexQueries.nextInvoiceNumber": nextInvoiceNumber,
  "FinanceIndexQueries.latestOurParty": latestOurParty,
  "FinanceIndexQueries.expenses": expenses,
  "FinanceIndexQueries.expenseCounts": expenseCounts,
  "FinanceIndexQueries.spend90d": spend90d,
  "FinanceIndexQueries.contacts": contacts,
  "FinanceIndexQueries.contactCounts": contactCounts,
  "FinanceIndexQueries.contact": contact,
  "FinanceIndexQueries.contactNames": contactNames,
  "FinanceIndexQueries.transaction": transaction,
  "FinanceIndexQueries.matchCandidates": matchCandidates,
  "FinanceIndexQueries.counts": counts,
  "FinanceIndexQueries.settings": settings,
  "FinanceIndexQueries.pairs": pairs,
  "FinanceIndexQueries.closingRates": closingRates,
  "FinanceIndexQueries.currenciesInUse": currenciesInUse,
};
