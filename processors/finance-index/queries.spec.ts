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
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nextNumber } from "../../editors/sektar/kit/invoice.js";
import { up } from "./migrations.js";
import {
  contactCountQuery,
  contactNamesQuery,
  contactsQuery,
  contactViewCountsQuery,
  expenseCountQuery,
  expenseSpendQuery,
  expensesQuery,
  expenseStatusQuery,
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
    book_gross: 0,
    book_outstanding: 0,
    book_rate_known: true,
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
        book_outstanding: 500,
        issued_at: "2026-10-01T00:00:00.000Z",
        our_party: JSON.stringify({ name: "Juniper", city: "Amsterdam" }),
      }),
      invoice("inv-2", {
        number: "INV-2026-0012",
        counterparty_name: "Acme",
        counterparty_contact_id: "c-acme",
        outstanding: 120,
        book_outstanding: 110,
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
        book_outstanding: 80,
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
    expect(counts.all).toBe(3);
    expect(counts.byStatus.map((s) => s.status)).toEqual(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED"]);
    expect(counts.byStatus.find((s) => s.status === "SUBMITTED")).toEqual({ status: "SUBMITTED", count: 1, total: 75, reimbursable: 75 });
    expect(counts.byStatus.find((s) => s.status === "REJECTED")).toEqual({ status: "REJECTED", count: 0, total: 0, reimbursable: 0 });
    const searched = toExpenseCounts(await expenseStatusQuery(db, ["a1"]).execute());
    expect(searched.all).toBe(1);
  });

  it("spend over the last 90 days counts receipts, not claims", async () => {
    const row = await expenseSpendQuery(db, spendSince(NOW)).executeTakeFirst();
    expect(Number(row?.spent)).toBe(100);
    const narrowed = await only(["exp-b"])(expenseSpendQuery(db, spendSince(NOW)), "report_id").executeTakeFirst();
    expect(narrowed?.spent ?? null).toBeNull();
  });
});

describe("contacts", () => {
  it("list by name with their open invoices and bank activity", async () => {
    const rows = (await contactsQuery(db, { view: "all" }, { limit: 10 }).execute()).map(toContactRow);
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
    expect(toContactRow(rows[0])).toMatchObject({ openInvoiceCount: 1, openBookOutstanding: 500, transactionCount: 0 });
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
