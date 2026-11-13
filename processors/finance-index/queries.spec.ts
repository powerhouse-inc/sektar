/**
 * The finance index's queries for claims, contacts, one transaction, match
 * candidates, numbers and counts, run on a real Postgres (PGlite in memory)
 * through the same Kysely builders the subgraph and the local mode use, in a
 * schema of its own as a drive's namespace is.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { PGlite } from "@electric-sql/pglite";
import { utils as contactUtils } from "document-models/contact";
import { utils as expenseUtils } from "document-models/expense-report";
import { utils as invoiceUtils, type InvoiceDocument } from "document-models/invoice/v2";
import {
  type DatabaseConnection,
  type Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryResult,
  sql,
} from "kysely";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { nextNumber } from "../../editors/sektar/kit/invoice.js";
import { up } from "./migrations.js";
import { Fx } from "./fx.js";
import { FinanceIndex } from "./processor.js";
import {
  contactCountQuery,
  contactNamesQuery,
  contactsQuery,
  contactViewCountsQuery,
  expenseCountQuery,
  expenseSpendQuery,
  expensesQuery,
  expenseStatusQuery,
  loadClosingRates,
  loadCurrenciesInUse,
  loadDashboard,
  loadFx,
  loadOpenByContact,
  loadPairs,
  loadSettings,
  invoiceNumbersQuery,
  latestOurPartyQuery,
  loadCounts,
  loadMatchCandidates,
  loadTransaction,
  nextNumberFrom,
  type QueryRestriction,
  spendSince,
  toContactCounts,
  toContactRow,
  toExpenseCounts,
  toExpenseSpend,
  toExpenseRow,
  toOurParty,
  transactionsQuery,
} from "./queries.js";
import { contactRow, expenseRows, numberSortKey } from "./rows.js";
import type { DB, InvoiceRow, TransactionRow } from "./schema.js";

/** Kysely over PGlite: one connection, queries passed straight through. */
class PGliteDriver implements Driver {
  constructor(private readonly pg: PGlite) {}
  init(): Promise<void> {
    return Promise.resolve();
  }
  acquireConnection(): Promise<DatabaseConnection> {
    const pg = this.pg;
    return Promise.resolve({
      async executeQuery<R>(query: {
        sql: string;
        parameters: readonly unknown[];
      }): Promise<QueryResult<R>> {
        const result = await pg.query<R>(query.sql, [...query.parameters]);
        return {
          rows: result.rows,
          numAffectedRows: BigInt(result.affectedRows ?? 0),
        };
      },
      streamQuery() {
        throw new Error("not used");
      },
    });
  }
  beginTransaction(): Promise<void> {
    return Promise.resolve();
  }
  commitTransaction(): Promise<void> {
    return Promise.resolve();
  }
  rollbackTransaction(): Promise<void> {
    return Promise.resolve();
  }
  releaseConnection(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): Promise<void> {
    return Promise.resolve();
  }
}

const pg = new PGlite();
const base = new Kysely<DB>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new PGliteDriver(pg),
    createIntrospector: (k) => new PostgresIntrospector(k),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});
// A drive's namespace is a schema of its own; the subqueries must follow it.
const db = base.withSchema("drive_ns");

const AT = "2026-10-20T08:00:00.000Z";
const NOW = Date.parse("2026-10-29T12:00:00.000Z");

function invoice(id: string, over: Partial<InvoiceRow>): InvoiceRow {
  return {
    document_id: id,
    direction: "OUTGOING",
    kind: "INVOICE",
    status: "OPEN",
    number: null,
    is_draft: false,
    counterparty_name: null,
    counterparty_contact_id: null,
    subject: null,
    first_line: null,
    currency: "EUR",
    issued_at: null,
    due_at: null,
    delivered_at: null,
    period_start: null,
    period_end: null,
    created_at: AT,
    gross: 0,
    outstanding: 0,
    rates: "[]",
    issued_copy_id: null,
    issued_copy_ref: null,
    line_count: 0,
    lines_missing_attachments: 0,
    last_paid_at: null,
    our_party: null,
    search_text: "",
    updated_at: AT,
    ...over,
    // the list's order key, as the processor writes it
    list_key: over.number ? numberSortKey(over.number) : id,
  };
}

function tx(id: string, over: Partial<TransactionRow>): TransactionRow {
  return {
    id,
    account_id: "acc-1",
    booked_at: "2026-10-01T00:00:00.000Z",
    counterparty: "",
    description: null,
    reference: null,
    category: "UNCATEGORIZED",
    status: "NEW",
    amount: 0,
    currency: "EUR",
    contact_id: null,
    matched_document_id: null,
    matched_kind: null,
    import_batch: null,
    search_text: "",
    ...over,
  };
}

const contact = (id: string, name: string, over: Record<string, unknown> = {}) =>
  contactRow(
    id,
    { ...contactUtils.createDocument().state.global, name, ...over },
    AT,
  );

const item = (id: string, spentAt: string, amount: number, paidWith: "PERSONAL" | "COMPANY_CARD" | "CASH") => ({
  id,
  spentAt,
  merchant: `Shop ${id}`,
  category: "TRAVEL" as const,
  amount,
  vatAmount: 0,
  paidWith,
  receiptName: null,
  note: null,
  contactId: null,
});

const claim = (
  id: string,
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "REIMBURSED",
  items: ReturnType<typeof item>[],
  updatedAt: string,
) =>
  expenseRows(
    id,
    {
      ...expenseUtils.createDocument().state.global,
      title: `Claim ${id}`,
      submitter: { name: "Mila", email: null },
      status,
      items,
    },
    AT,
    updatedAt,
  );

/** The caller may read only these documents: the readable-documents filter's shape. */
const only =
  (ids: string[]): QueryRestriction =>
  (q, column) =>
    q.where(sql<boolean>`${sql.ref(column)} in (${sql.join(ids)})`);

beforeAll(async () => {
  await base.schema.createSchema("drive_ns").execute();
  await up(db);
  // A store made before these tables gains them on the next start.
  await up(db);

  await db
    .insertInto("invoice_index")
    .values([
      invoice("inv-1", {
        number: "INV-2026-0007",
        counterparty_name: "Acme",
        counterparty_contact_id: "c-acme",
        outstanding: 500,
        issued_at: "2026-10-01T00:00:00.000Z",
        our_party: JSON.stringify({ name: "Juniper", city: "Amsterdam" }),
      }),
      invoice("inv-2", {
        number: "INV-2026-0012",
        counterparty_name: "Acme",
        counterparty_contact_id: "c-acme",
        // in dollars, with its own rate: 120 USD is 110 EUR
        currency: "USD",
        outstanding: 120,
        rates: JSON.stringify([{ base: "USD", quote: "EUR", rate: 11 / 12 }]),
        issued_at: "2026-10-10T00:00:00.000Z",
        our_party: JSON.stringify({ name: "Juniper BV", city: "Amsterdam" }),
      }),
      invoice("inv-3", {
        number: "INV-2026-0009",
        status: "PAID",
        counterparty_contact_id: "c-acme",
        issued_at: "2026-10-12T00:00:00.000Z",
      }),
      invoice("draft", {
        status: "DRAFT",
        is_draft: true,
        counterparty_contact_id: "c-acme",
        created_at: "2026-10-28T00:00:00.000Z",
        our_party: JSON.stringify({ name: "Newest draft" }),
      }),
      invoice("bill-1", {
        direction: "INCOMING",
        number: "B-77",
        counterparty_name: "Paper Co",
        counterparty_contact_id: "c-paper",
        outstanding: 80,
      }),
    ])
    .execute();
  await db
    .insertInto("account_index")
    .values({
      document_id: "acc-1",
      name: "Main",
      kind: "CREDIT_CARD",
      institution: null,
      iban_last4: null,
      currency: "EUR",
      opening_balance: 0,
      balance: 0,
      tx_count: 3,
      new_count: 1,
      last_imported_at: null,
      updated_at: AT,
    })
    .execute();
  await db
    .insertInto("transaction_index")
    .values([
      tx("t1", { contact_id: "c-acme", booked_at: "2026-10-02T00:00:00.000Z", amount: 500 }),
      tx("t2", {
        contact_id: "c-acme",
        booked_at: "2026-10-05T00:00:00.000Z",
        amount: 120,
        status: "MATCHED",
        matched_document_id: "inv-2",
        matched_kind: "INVOICE",
      }),
      tx("t3", {
        amount: -42,
        status: "MATCHED",
        matched_document_id: "exp-a",
        matched_kind: "EXPENSE",
      }),
    ])
    .execute();

  const claims = [
    claim("exp-a", "APPROVED", [item("a1", "2026-10-20T00:00:00.000Z", 40, "PERSONAL"), item("a2", "2026-10-21T00:00:00.000Z", 60, "COMPANY_CARD")], "2026-10-22T00:00:00.000Z"),
    claim("exp-b", "SUBMITTED", [item("b1", "2026-06-01T00:00:00.000Z", 75, "CASH")], "2026-10-25T00:00:00.000Z"),
    claim("exp-c", "DRAFT", [], "2026-10-26T00:00:00.000Z"),
  ];
  await db.insertInto("expense_index").values(claims.map((c) => c.report)).execute();
  await db
    .insertInto("expense_item_index")
    .values(claims.flatMap((c) => c.items))
    .execute();

  await db
    .insertInto("contact_index")
    .values([
      contact("c-acme", "acme", { kind: "CUSTOMER", tags: ["retainer"] }),
      contact("c-paper", "Paper Co", { kind: "SUPPLIER" }),
      contact("c-both", "Beta", { kind: "BOTH", address: { street: null, postalCode: null, city: "Ghent", country: "BE" } }),
      contact("c-old", "Zulu", { kind: "CUSTOMER", status: "ARCHIVED" }),
    ])
    .execute();
});

afterAll(async () => {
  await pg.close();
});

describe("claims", () => {
  it("list the latest changed first, by status and search", async () => {
    const all = await expensesQuery(db, {}, { limit: 10 }).execute();
    expect(all.map((r) => r.document_id)).toEqual(["exp-c", "exp-b", "exp-a"]);
    const approved = await expensesQuery(db, { statuses: ["APPROVED", "REIMBURSED"] }, { limit: 10 }).execute();
    expect(approved.map(toExpenseRow)).toMatchObject([
      { id: "exp-a", total: 100, reimbursable: 40, itemCount: 2, categories: ["TRAVEL"] },
    ]);
    const searched = await expensesQuery(db, { words: ["shop", "b1"] }, { limit: 10 }).execute();
    expect(searched.map((r) => r.document_id)).toEqual(["exp-b"]);
    const counted = await expenseCountQuery(db, { statuses: ["DRAFT"] }).executeTakeFirst();
    expect(Number(counted?.n)).toBe(1);
  });

  it("count and add up per status", async () => {
    const counts = toExpenseCounts(await expenseStatusQuery(db).execute());
    expect(counts.bookCurrency).toBe("EUR");
    expect(counts.unconverted).toEqual([]);
    expect(counts.all).toBe(3);
    expect(counts.byStatus.map((s) => s.status)).toEqual(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED"]);
    expect(counts.byStatus.find((s) => s.status === "SUBMITTED")).toEqual({ status: "SUBMITTED", count: 1, total: 75, reimbursable: 75 });
    expect(counts.byStatus.find((s) => s.status === "REJECTED")).toEqual({ status: "REJECTED", count: 0, total: 0, reimbursable: 0 });
    const searched = toExpenseCounts(await expenseStatusQuery(db, ["a1"]).execute());
    expect(searched.all).toBe(1);
  });

  it("spend over the last 90 days counts receipts, not claims", async () => {
    const rows = await expenseSpendQuery(db, spendSince(NOW)).execute();
    expect(toExpenseSpend(rows)).toBe(100);
    const narrowed = await only(["exp-b"])(expenseSpendQuery(db, spendSince(NOW)), "report_id").execute();
    expect(toExpenseSpend(narrowed)).toBe(0);
  });
});

describe("contacts", () => {
  it("list by name with their open invoices and bank activity", async () => {
    const found = await contactsQuery(db, { view: "all" }, { limit: 10 }).execute();
    const open = await loadOpenByContact(db, found.map((r) => r.document_id), await loadFx(db));
    const rows = found.map((r) => toContactRow(r, open));
    expect(rows.map((r) => r.name)).toEqual(["acme", "Beta", "Paper Co"]);
    expect(rows[0]).toMatchObject({
      id: "c-acme",
      kind: "CUSTOMER",
      tags: ["retainer"],
      openInvoiceCount: 2,
      openBookOutstanding: 610,
      transactionCount: 2,
      lastTransactionAt: "2026-10-05T00:00:00.000Z",
    });
    expect(rows[1]).toMatchObject({ name: "Beta", city: "Ghent", openInvoiceCount: 0, openBookOutstanding: 0, transactionCount: 0, lastTransactionAt: null });
  });

  it("filter by relationship, archive and search, and count the filters", async () => {
    const names = async (view: "customers" | "suppliers" | "archived") =>
      (await contactsQuery(db, { view }, { limit: 10 }).execute()).map((r) => r.name);
    expect(await names("customers")).toEqual(["acme", "Beta"]);
    expect(await names("suppliers")).toEqual(["Beta", "Paper Co"]);
    expect(await names("archived")).toEqual(["Zulu"]);
    const ghent = await contactsQuery(db, { view: "all", words: ["ghent"] }, { limit: 10 }).execute();
    expect(ghent.map((r) => r.document_id)).toEqual(["c-both"]);
    expect(Number((await contactCountQuery(db, { view: "all" }).executeTakeFirst())?.n)).toBe(3);
    expect(toContactCounts(await contactViewCountsQuery(db).executeTakeFirst())).toEqual({
      all: 3,
      customers: 2,
      suppliers: 2,
      archived: 1,
    });
  });

  it("leave out of the aggregates what the caller may not read", async () => {
    const restrict = only(["c-acme", "inv-1"]);
    const rows = await restrict(
      contactsQuery(db, { id: "c-acme" }, { limit: 1 }, restrict),
      "contact_index.document_id",
    ).execute();
    // inv-2 and the account are not readable: one open invoice, no activity.
    const open = await loadOpenByContact(db, ["c-acme"], await loadFx(db, restrict), restrict);
    expect(toContactRow(rows[0], open)).toMatchObject({ openInvoiceCount: 1, openBookOutstanding: 500, transactionCount: 0 });
    // without a page of contacts there is nothing to ask
    expect(await loadOpenByContact(db, [], await loadFx(db))).toEqual(new Map());
  });

  it("name the ones asked for, and none for no ids", async () => {
    const named = await contactNamesQuery(db, ["c-paper", "nope"]).execute();
    expect(named).toEqual([{ document_id: "c-paper", name: "Paper Co" }]);
    expect(await contactNamesQuery(db, []).execute()).toEqual([]);
  });

  it("filter a contact's invoices and transactions", async () => {
    const txs = await transactionsQuery(db, { contactId: "c-acme" }, { limit: 8 }).execute();
    expect(txs.map((t) => t.id)).toEqual(["t2", "t1"]);
  });
});

describe("one transaction", () => {
  it("comes with its account and what it is matched to", async () => {
    expect(await loadTransaction(db, "t2")).toMatchObject({
      id: "t2",
      accountId: "acc-1",
      accountName: "Main",
      accountKind: "CREDIT_CARD",
      matchedLabel: "INV-2026-0012",
    });
    expect(await loadTransaction(db, "t3")).toMatchObject({ matchedLabel: "Claim exp-a" });
    expect(await loadTransaction(db, "t1")).toMatchObject({ matchedLabel: null });
    expect(await loadTransaction(db, "nope")).toBeNull();
  });

  it("is not found where its account may not be read", async () => {
    expect(await loadTransaction(db, "t1", only(["inv-1"]))).toBeNull();
  });
});

describe("match candidates", () => {
  it("are OPEN sales invoices for money in, closest first", async () => {
    const found = await loadMatchCandidates(db, 130);
    expect(found.map((c) => [c.kind, c.id, c.distance])).toEqual([
      ["INVOICE", "inv-2", 10],
      ["INVOICE", "inv-1", 370],
    ]);
    expect(found[0].label).toBe("INV-2026-0012 · Acme");
  });

  it("are bills and approved or submitted claims for money out", async () => {
    const found = await loadMatchCandidates(db, -70);
    expect(found.map((c) => [c.kind, c.id, c.amount])).toEqual([
      ["EXPENSE", "exp-b", 75],
      ["INVOICE", "bill-1", 80],
      ["EXPENSE", "exp-a", 40],
    ]);
  });
});

describe("numbers and our side", () => {
  it("lists a direction's numbers and proposes the next as the issue dialog does", async () => {
    const rows = await invoiceNumbersQuery(db, "OUTGOING").execute();
    expect(rows.map((r) => r.number)).toEqual(["INV-2026-0012", "INV-2026-0009", "INV-2026-0007"]);
    const used = rows.map((r) => r.number ?? "");
    expect(nextNumberFrom(used, "OUTGOING", new Date(NOW))).toBe("INV-2026-0013");
  });

  it("agrees with the editor's nextNumber", () => {
    const at = new Date(NOW);
    const doc = (direction: "OUTGOING" | "INCOMING", number: string): InvoiceDocument => {
      const d = invoiceUtils.createDocument();
      return { ...d, state: { ...d.state, global: { ...d.state.global, direction, number } } };
    };
    const cases: [("OUTGOING" | "INCOMING"), string[]][] = [
      ["OUTGOING", []],
      ["INCOMING", []],
      ["OUTGOING", ["2026009", "2026010"]],
      ["OUTGOING", ["INV-2025-0012"]],
      ["OUTGOING", ["2025015"]],
      ["OUTGOING", ["A-7", "A-12", "INV-2026-0001"]],
      ["INCOMING", ["BILL-2026-009"]],
    ];
    for (const [direction, numbers] of cases) {
      expect(nextNumberFrom(numbers, direction, at)).toBe(
        nextNumber(numbers.map((n) => doc(direction, n)), direction, at),
      );
    }
  });

  it("takes our side from the latest invoice that names it", async () => {
    const row = await latestOurPartyQuery(db, "OUTGOING").executeTakeFirst();
    // The draft has no issue date: its creation (28 Oct) is the latest.
    expect(toOurParty(row?.our_party)).toMatchObject({ name: "Newest draft", city: null });
    expect(await latestOurPartyQuery(db, "INCOMING").executeTakeFirst()).toBeUndefined();
  });
});

describe("counts", () => {
  it("count each kind of document, for what the caller may read", async () => {
    expect(await loadCounts(db)).toEqual({ accounts: 1, invoices: 5, expenses: 3, contacts: 4 });
    expect(await loadCounts(db, only(["inv-1", "c-acme"]))).toEqual({ accounts: 0, invoices: 1, expenses: 0, contacts: 1 });
  });
});

/**
 * Books that hold more than one currency, in a drive of their own: every
 * total is converted once, on reading, into the books' main currency.
 */
describe("currency conversion", () => {
  const fxDb = base.withSchema("fx_ns");
  const account = (id: string, kind: string, currency: string, balance: number) => ({
    document_id: id,
    name: id,
    kind,
    institution: null,
    iban_last4: null,
    currency,
    opening_balance: 0,
    balance,
    tx_count: 0,
    new_count: 0,
    last_imported_at: null,
    updated_at: AT,
  });
  const tx = (id: string, accountId: string, currency: string, bookedAt: string, amount: number, category = "SALES") => ({
    id,
    account_id: accountId,
    booked_at: bookedAt,
    counterparty: id,
    description: null,
    reference: null,
    category,
    status: "CATEGORIZED",
    amount,
    currency,
    contact_id: null,
    matched_document_id: null,
    matched_kind: null,
    import_batch: null,
    search_text: id,
  });
  const rate = (pair: string, baseCurrency: string, quote: string, day: string, value: number) => ({
    pair_id: pair,
    base: baseCurrency,
    quote,
    day,
    rate: value,
  });

  beforeAll(async () => {
    await base.schema.createSchema("fx_ns").execute();
    // A store made before amounts were converted on reading.
    await sql`create table fx_ns.invoice_index (
      document_id varchar(255) primary key, direction varchar(16) not null, kind varchar(16) not null,
      status varchar(16) not null, number varchar(255), is_draft boolean not null default true,
      list_key text not null default '', counterparty_name text, counterparty_contact_id varchar(255),
      subject text, first_line text, currency varchar(8) not null, issued_at varchar(64), due_at varchar(64),
      delivered_at varchar(64), period_start varchar(64), period_end varchar(64), created_at varchar(64) not null,
      gross double precision not null default 0, outstanding double precision not null default 0,
      book_gross double precision not null default 0, book_outstanding double precision not null default 0,
      book_rate_known boolean not null default true, issued_copy_id varchar(255), issued_copy_ref text,
      line_count integer not null default 0, lines_missing_attachments integer not null default 0,
      last_paid_at varchar(64), our_party text, search_text text not null default '', updated_at varchar(64) not null
    )`.execute(base);
    await up(fxDb);
    await up(fxDb);

    await fxDb
      .insertInto("account_index")
      .values([
        account("acc-eur", "CURRENT", "EUR", 1000),
        account("acc-usd", "CURRENT", "USD", 1000),
        account("acc-chf", "SAVINGS", "CHF", 500),
        account("card-usd", "CREDIT_CARD", "USD", -200),
      ])
      .execute();
    await fxDb
      .insertInto("transaction_index")
      .values([
        tx("t1", "acc-usd", "USD", "2026-10-02T00:00:00.000Z", 100),
        tx("t2", "acc-usd", "USD", "2026-10-12T00:00:00.000Z", 100),
        tx("t3", "acc-usd", "USD", "2026-10-12T00:00:00.000Z", -50, "SOFTWARE"),
        tx("t4", "acc-eur", "EUR", "2026-10-12T00:00:00.000Z", -30, "SOFTWARE"),
        tx("t5", "acc-chf", "CHF", "2026-10-12T00:00:00.000Z", -999, "RENT"),
      ])
      .execute();
    await fxDb
      .insertInto("invoice_index")
      .values([
        invoice("fx-inv-1", { currency: "USD", outstanding: 100, counterparty_contact_id: "c-x" }),
        invoice("fx-inv-2", {
          currency: "USD",
          outstanding: 100,
          counterparty_contact_id: "c-x",
          rates: JSON.stringify([{ base: "USD", quote: "EUR", rate: 0.9 }]),
        }),
        invoice("fx-inv-3", { currency: "JPY", outstanding: 5000, counterparty_contact_id: "c-x" }),
        invoice("fx-bill", { direction: "INCOMING", currency: "EUR", outstanding: 40 }),
      ])
      .execute();
    const claims = [
      { ...claim("fx-exp", "SUBMITTED", [item("f1", "2026-10-02T00:00:00.000Z", 100, "PERSONAL"), item("f2", "2026-10-12T00:00:00.000Z", 100, "COMPANY_CARD")], AT) },
    ];
    await fxDb
      .insertInto("expense_index")
      .values(claims.map((c) => ({ ...c.report, currency: "USD" })))
      .execute();
    await fxDb.insertInto("expense_item_index").values(claims.flatMap((c) => c.items)).execute();
    const pair = (id: string, baseCurrency: string | null, quote: string | null, createdAt: string) => ({
      document_id: id,
      base: baseCurrency,
      quote,
      rate_count: 1,
      first_day: "2026-10-01",
      last_day: "2026-10-10",
      last_rate: 0.8,
      last_source: "ECB",
      last_fetched_at: AT,
      created_at: createdAt,
      updated_at: AT,
    });
    await fxDb
      .insertInto("pair_index")
      .values([
        // made later than pair-usd: a second document for the same pair
        pair("pair-usd-2", "USD", "EUR", "2026-10-02T00:00:00.000Z"),
        pair("pair-usd", "USD", "EUR", "2026-10-01T00:00:00.000Z"),
        pair("pair-chf-gbp", "CHF", "GBP", "2026-10-01T00:00:00.000Z"),
        pair("pair-eur-usd", "EUR", "USD", "2026-10-01T00:00:00.000Z"),
        pair("pair-unnamed", null, null, "2026-10-01T00:00:00.000Z"),
      ])
      .execute();
    await fxDb
      .insertInto("rate_index")
      .values([
        rate("pair-usd", "USD", "EUR", "2026-10-01", 0.5),
        rate("pair-usd", "USD", "EUR", "2026-10-10", 0.8),
        // a second document for the same pair is ignored, whole
        rate("pair-usd-2", "USD", "EUR", "2026-10-20", 9),
        // quoted in another currency: not the books'
        rate("pair-chf-gbp", "CHF", "GBP", "2026-10-10", 0.9),
        rate("pair-eur-usd", "EUR", "USD", "2026-10-10", 1.25),
      ])
      .execute();
  });

  it("moves an older invoice table to amounts in their own currency", async () => {
    const tables = await fxDb.introspection.getTables();
    const columns = tables
      .filter((t) => t.name === "invoice_index" && t.schema === "fx_ns")
      .flatMap((t) => t.columns.map((c) => c.name));
    expect(columns).toContain("rates");
    expect(columns).not.toContain("book_gross");
    expect(columns).not.toContain("book_outstanding");
    expect(columns).not.toContain("book_rate_known");
  });

  it("are in euros until the books say otherwise, then in the oldest settings' currency", async () => {
    expect(await loadSettings(fxDb)).toEqual({ documentId: null, bookCurrency: "EUR" });
    const fx = await loadFx(fxDb);
    expect(fx.bookCurrency).toBe("EUR");
    expect((await loadPairs(fxDb)).map((p) => `${p.base}/${p.quote}:${p.id}`)).toEqual([
      "CHF/GBP:pair-chf-gbp",
      "EUR/USD:pair-eur-usd",
      "USD/EUR:pair-usd",
    ]);
    expect((await loadPairs(fxDb))[2]).toEqual({
      id: "pair-usd",
      base: "USD",
      quote: "EUR",
      rateCount: 1,
      firstDay: "2026-10-01",
      lastDay: "2026-10-10",
      lastRate: 0.8,
      lastSource: "ECB",
      lastFetchedAt: AT,
    });
    // the oldest pair document's rates only, and only those quoted in euros
    expect(fx.rate("USD")).toBe(0.8);
    expect(fx.rate("CHF")).toBeNull();
  });

  it("name every currency in use and the first day it needs a rate for", async () => {
    expect(await loadCurrenciesInUse(fxDb)).toEqual([
      { currency: "CHF", since: "2026-10-12" },
      { currency: "EUR", since: "2026-10-12" },
      { currency: "JPY", since: null },
      { currency: "USD", since: "2026-10-02" },
    ]);
    // a reader of one account sees only its currency
    expect(await loadCurrenciesInUse(fxDb, only(["acc-chf"]))).toEqual([
      { currency: "CHF", since: "2026-10-12" },
    ]);
  });

  it("convert the dashboard's totals once and name what they left out", async () => {
    const stats = await loadDashboard(fxDb, NOW);
    expect(stats.bookCurrency).toBe("EUR");
    // 1000 + 1000 USD at the latest rate; the francs have no rate
    expect(stats.cash).toBe(1800);
    expect(stats.card).toBe(-160);
    // 100 USD at the books' latest + 100 USD at the invoice's own rate
    expect(stats.receivable).toBe(170);
    expect(stats.payable).toBe(40);
    expect(stats.unconverted).toEqual(["CHF", "JPY"]);
    // each day's dollars at that day's rate: 100 * 0.5, then (100 and -50) * 0.8
    expect(stats.months.at(-1)).toEqual({ key: "2026-10", in: 130, out: 70 });
    expect(stats.spend).toEqual([{ category: "SOFTWARE", amount: 70 }]);
    // a row keeps its own currency
    expect(stats.recent.find((t) => t.id === "t1")).toMatchObject({ amount: 100, currency: "USD" });
  });

  it("answer the rate that closed each year, for totals outside the finance index", async () => {
    await fxDb
      .insertInto("rate_index")
      .values([
        rate("pair-usd", "USD", "EUR", "2025-12-30", 0.95),
        rate("pair-usd", "USD", "EUR", "2025-12-31", 0.96),
        rate("pair-usd", "USD", "EUR", "2025-06-01", 0.9),
      ])
      .execute();
    const closing = await loadClosingRates(fxDb);
    expect(closing).toEqual({
      bookCurrency: "EUR",
      rates: [
        { base: "USD", day: "2025-12-31", rate: 0.96 },
        // the year still running: its latest rate
        { base: "USD", day: "2026-10-10", rate: 0.8 },
      ],
    });
    const fx = new Fx(closing.bookCurrency, closing.rates);
    expect(fx.rate("USD", "2025-12-31")).toBe(0.96);
    expect(fx.rate("USD", "2026-12-31")).toBe(0.8);
    // a year before any rate: the earliest there is
    expect(fx.rate("USD", "2019-12-31")).toBe(0.96);
    // a reader who may read no pair converts nothing
    expect(await loadClosingRates(fxDb, only(["nothing"]))).toEqual({ bookCurrency: "EUR", rates: [] });
    await fxDb.deleteFrom("rate_index").where("day", "like", "2025-%").execute();
  });

  it("convert the claims' totals and the 90-day spend", async () => {
    const fx = await loadFx(fxDb);
    const counts = toExpenseCounts(await expenseStatusQuery(fxDb).execute(), fx);
    expect(counts.byStatus.find((s) => s.status === "SUBMITTED")).toEqual({
      status: "SUBMITTED",
      count: 1,
      total: 160,
      reimbursable: 80,
    });
    expect(counts.unconverted).toEqual([]);
    const spent = toExpenseSpend(await expenseSpendQuery(fxDb, spendSince(NOW)).execute(), fx);
    expect(spent).toBe(130);
  });

  it("add up what a contact owes across currencies, leaving out what has no rate", async () => {
    const fx = await loadFx(fxDb);
    const open = await loadOpenByContact(fxDb, ["c-x", "c-none"], fx);
    expect(open.get("c-x")).toBe(170);
    expect(open.has("c-none")).toBe(false);
    expect(fx.unconverted()).toEqual(["JPY"]);
  });

  it("follow the books to another main currency, with that currency's own pairs", async () => {
    await fxDb
      .insertInto("settings_index")
      .values([
        { document_id: "set-new", base_currency: "GBP", created_at: "2026-10-05T00:00:00.000Z", updated_at: AT },
        { document_id: "set-old", base_currency: "USD", created_at: "2026-10-01T00:00:00.000Z", updated_at: AT },
      ])
      .execute();
    expect(await loadSettings(fxDb)).toEqual({ documentId: "set-old", bookCurrency: "USD" });
    const stats = await loadDashboard(fxDb, NOW);
    expect(stats.bookCurrency).toBe("USD");
    // dollars as they are; euros at the EUR->USD pair, never the inverse of USD->EUR
    expect(stats.cash).toBe(1000 + 1000 * 1.25);
    expect(stats.card).toBe(-200);
    expect(stats.unconverted).toEqual(["CHF", "JPY"]);
    // a reader who may not open the settings sees the books in euros
    expect(await loadSettings(fxDb, only(["nothing"]))).toEqual({ documentId: null, bookCurrency: "EUR" });
    expect((await loadFx(fxDb, only(["set-old", "pair-eur-usd"]))).rate("EUR")).toBe(1.25);
    expect((await loadFx(fxDb, only(["set-old"]))).rate("EUR")).toBeNull();
  });
});

/**
 * An index from before this update: its invoice rows carry no rates of their
 * own. The first start after the update reads them off the invoices, once.
 */
describe("invoices from before the update", () => {
  const oldDb = base.withSchema("refill_ns");
  const usd = (rate: number) => ({
    global: {
      ...invoiceUtils.createDocument().state.global,
      currency: "USD",
      exchangeRates: [{ base: "USD", quote: "EUR", rate, date: null, source: null }],
    },
  });

  beforeAll(async () => {
    await base.schema.createSchema("refill_ns").execute();
    await sql`create table refill_ns.invoice_index (
      document_id varchar(255) primary key, direction varchar(16) not null, kind varchar(16) not null,
      status varchar(16) not null, number varchar(255), is_draft boolean not null default true,
      list_key text not null default '', counterparty_name text, counterparty_contact_id varchar(255),
      subject text, first_line text, currency varchar(8) not null, issued_at varchar(64), due_at varchar(64),
      delivered_at varchar(64), period_start varchar(64), period_end varchar(64), created_at varchar(64) not null,
      gross double precision not null default 0, outstanding double precision not null default 0,
      book_gross double precision not null default 0, book_outstanding double precision not null default 0,
      book_rate_known boolean not null default true, issued_copy_id varchar(255), issued_copy_ref text,
      line_count integer not null default 0, lines_missing_attachments integer not null default 0,
      last_paid_at varchar(64), our_party text, search_text text not null default '', updated_at varchar(64) not null
    )`.execute(base);
    for (const id of ["old-usd", "old-eur", "old-gone", "old-odd"]) {
      await sql`insert into refill_ns.invoice_index (document_id, direction, kind, status, currency, created_at, outstanding, updated_at)
        values (${id}, 'OUTGOING', 'INVOICE', 'OPEN', ${id === "old-eur" ? "EUR" : "USD"}, ${AT}, 100, ${AT})`.execute(base);
    }
    await up(oldDb);
  });

  it("have no rates of their own until they are read off the invoices", async () => {
    const rows = await oldDb.selectFrom("invoice_index").select(["document_id", "rates"]).execute();
    expect(rows.every((r) => r.rates === null)).toBe(true);
    // until then a total uses the books' rate, and without one leaves the invoice out
    const stats = await loadDashboard(oldDb, NOW);
    expect(stats.receivable).toBe(100);
    expect(stats.unconverted).toEqual(["USD"]);
  });

  it("are refilled once, at the rate each invoice carries", async () => {
    const index = new FinanceIndex("refill_ns", {}, oldDb as never, "drive-old");
    const asked: string[] = [];
    const read = {
      get: (id: string) => {
        asked.push(id);
        if (id === "old-gone") return Promise.reject(new Error("not found"));
        if (id === "old-odd") return Promise.resolve({ state: { global: { nothing: true } } });
        if (id === "old-eur") return Promise.resolve({ state: { global: invoiceUtils.createDocument().state.global } });
        return Promise.resolve({ state: usd(0.9) });
      },
    };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await index.refillInvoiceRates(read)).toBe(3);
    const rows = await oldDb.selectFrom("invoice_index").select(["document_id", "rates"]).orderBy("document_id").execute();
    expect(rows).toEqual([
      { document_id: "old-eur", rates: "[]" },
      // unreadable now: left for the next start
      { document_id: "old-gone", rates: null },
      // not an invoice's state: nothing to carry
      { document_id: "old-odd", rates: "[]" },
      { document_id: "old-usd", rates: JSON.stringify([{ base: "USD", quote: "EUR", rate: 0.9 }]) },
    ]);
    // 100 EUR + 100 USD at the invoice's own 0.9 + the dollar invoice with nothing to carry, left out
    const stats = await loadDashboard(oldDb, NOW);
    expect(stats.receivable).toBe(190);

    // the next start asks only for what is still waiting
    asked.length = 0;
    expect(await index.refillInvoiceRates(read)).toBe(0);
    expect(asked).toEqual(["old-gone"]);
    vi.restoreAllMocks();
  });

  it("never overwrites a row the invoice has been edited into since", async () => {
    await oldDb.updateTable("invoice_index").set({ rates: null }).where("document_id", "=", "old-usd").execute();
    const index = new FinanceIndex("refill_ns", {}, oldDb as never, "drive-old");
    const read = {
      get: async (id: string) => {
        if (id === "old-usd") {
          // an edit lands while the invoice is being read
          await oldDb.updateTable("invoice_index").set({ rates: "[\"edited\"]" }).where("document_id", "=", id).execute();
          return { state: usd(0.5) };
        }
        throw new Error("not found");
      },
    };
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await index.refillInvoiceRates(read);
    const row = await oldDb.selectFrom("invoice_index").select("rates").where("document_id", "=", "old-usd").executeTakeFirst();
    expect(row?.rates).toBe("[\"edited\"]");
    vi.restoreAllMocks();
  });
});
