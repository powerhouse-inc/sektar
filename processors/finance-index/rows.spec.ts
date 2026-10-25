/**
 * What the finance index writes for an invoice and a bank account, and how
 * the dashboard folds its queries.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import type { BankAccountState, Transaction } from "document-models/bank-account";
import {
  addAttachment,
  addLine,
  computeTotals,
  issueInvoice,
  recordPayment,
  reducer,
  setBuyer,
  setCurrency,
  setExchangeRate,
  setHeader,
  setSeller,
  utils,
  type InvoiceDocument,
} from "document-models/invoice/v2";
import { describe, expect, it } from "vitest";
import {
  BOOK_CURRENCY as KIT_BOOK_CURRENCY,
  CATEGORY,
  bookTotals,
  invoiceTotals,
} from "../../editors/sektar/kit/format.js";
import {
  dashboardMonths,
  searchWords,
  toDashboardStats,
  toInvoiceCounts,
  toInvoiceRow,
  toTransactionCounts,
} from "./queries.js";
import {
  accountRows,
  accountState,
  BOOK_CURRENCY,
  CATEGORY_LABEL,
  diffTransactions,
  invoiceAmounts,
  invoiceRow,
  invoiceState,
  numberSortKey,
  parseState,
} from "./rows.js";

const AT = "2026-10-20T08:00:00.000Z";
const CREATED = "2026-09-01T10:00:00.000Z";
const PDF = "attachment://v1:5311d387c1e9d56010dd23e5d04dbadb8d69b95e0a5996cbd4bffb14d0fc494f" as const;

type Action = Parameters<typeof reducer>[1];
const apply = (doc: InvoiceDocument, ...actions: Action[]) =>
  actions.reduce((d, a) => reducer(d, a), doc);

const line = (id: string, unitPrice: number, quantity = 1, vatRate = 21) =>
  addLine({
    id,
    description: `Line ${id}`,
    quantity,
    unitPrice,
    vatCategory: "STANDARD",
    vatRate,
  });

function sale(): InvoiceDocument {
  return apply(
    utils.createDocument(),
    setHeader({ direction: "OUTGOING", subject: "October retainer", buyerReference: "PO-77" }),
    setBuyer({ name: "Acme BV", contactId: "contact-1" }),
    setSeller({ name: "Sektar" }),
    line("l1", 1234.567, 3),
    line("l2", 99.99, 1, 9),
  );
}

describe("an invoice's row", () => {
  it("takes what the list shows, totals from computeTotals", () => {
    const doc = apply(
      sale(),
      issueInvoice({ number: "2026010", issuedAt: "2026-10-01T00:00:00.000Z", dueAt: "2026-10-15T00:00:00.000Z" }),
      recordPayment({ id: "p1", amount: 500, method: "BANK_TRANSFER", paidAt: "2026-10-05T00:00:00.000Z" }),
    );
    const s = doc.state.global;
    const row = invoiceRow("inv-1", s, CREATED, AT);
    const t = computeTotals(s);
    expect(row).toMatchObject({
      document_id: "inv-1",
      direction: "OUTGOING",
      kind: "INVOICE",
      status: "OPEN",
      number: "2026010",
      is_draft: false,
      list_key: numberSortKey("2026010"),
      counterparty_name: "Acme BV",
      counterparty_contact_id: "contact-1",
      subject: "October retainer",
      first_line: "Line l1",
      currency: "EUR",
      due_at: "2026-10-15T00:00:00.000Z",
      created_at: CREATED,
      gross: t.gross,
      outstanding: t.due,
      book_gross: t.gross,
      book_outstanding: t.due,
      book_rate_known: true,
      line_count: 2,
      lines_missing_attachments: 2,
      last_paid_at: "2026-10-05T00:00:00.000Z",
      updated_at: AT,
    });
    // Agrees with the boards' own helpers to the cent.
    expect(row.gross).toBe(invoiceTotals(s).gross);
    expect(row.outstanding).toBe(invoiceTotals(s).outstanding);
    expect(row.book_outstanding).toBe(bookTotals(s).outstanding);
    expect(row.search_text).toContain("2026010");
    expect(row.search_text).toContain("acme bv");
    expect(row.search_text).toContain("po-77");
    expect(row.search_text).toContain(String(t.gross));
  });

  it("converts to the book currency at the invoice's rate, as bookTotals does", () => {
    const doc = apply(
      sale(),
      setCurrency({ currency: "USD" }),
      setExchangeRate({ base: "EUR", quote: "USD", rate: 1.141897 }),
    );
    const s = doc.state.global;
    const a = invoiceAmounts(s);
    const b = bookTotals(s);
    expect(a.bookRateKnown).toBe(true);
    expect(a.bookGross).toBe(b.gross);
    expect(a.bookOutstanding).toBe(b.outstanding);
    expect(a.bookGross).not.toBe(a.gross);
  });

  it("leaves the book amounts unconverted without a rate, and says so", () => {
    const s = apply(sale(), setCurrency({ currency: "SEK" })).state.global;
    const a = invoiceAmounts(s);
    expect(a.bookRateKnown).toBe(false);
    expect(a.bookGross).toBe(a.gross);
    expect(a.bookGross).toBe(bookTotals(s).gross);
  });

  it("never owes below zero", () => {
    const s = apply(
      sale(),
      setHeader({ roundingAmount: -1_000_000 }),
    ).state.global;
    expect(computeTotals(s).due).toBeLessThan(0);
    expect(invoiceRow("i", s, CREATED, AT).outstanding).toBe(0);
  });

  it("orders a draft by what it covers, else when it was made", () => {
    const draft = sale().state.global;
    expect(invoiceRow("i", draft, CREATED, AT)).toMatchObject({ is_draft: true, list_key: CREATED });
    const delivered = apply(sale(), setHeader({ deliveredAt: "2026-10-03T00:00:00.000Z", periodEnd: "2026-10-31T00:00:00.000Z" })).state.global;
    expect(invoiceRow("i", delivered, CREATED, AT).list_key).toBe("2026-10-03T00:00:00.000Z");
    const period = apply(sale(), setHeader({ periodStart: "2026-10-01T00:00:00.000Z", periodEnd: "2026-10-31T00:00:00.000Z" })).state.global;
    expect(invoiceRow("i", period, CREATED, AT).list_key).toBe("2026-10-31T00:00:00.000Z");
  });

  it("sorts numbers as the workspace does (numeric runs)", () => {
    const numbers = ["INV-9", "INV-10", "2026009", "2026010", "inv-100"];
    const byKey = [...numbers].sort((a, b) => numberSortKey(b).localeCompare(numberSortKey(a)));
    const byWorkspace = [...numbers].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    expect(byKey).toEqual(byWorkspace);
  });

  it("names the issued copy and counts lines without a receipt", () => {
    const s = apply(
      sale(),
      addAttachment({ id: "a1", role: "ISSUED_COPY", fileName: "inv.pdf", mimeType: "application/pdf", ref: PDF, addedAt: AT }),
      addAttachment({ id: "a2", role: "RECEIPT", fileName: "r.pdf", mimeType: "application/pdf", ref: PDF, addedAt: AT, lineId: "l1" }),
    ).state.global;
    const row = invoiceRow("i", s, CREATED, AT);
    expect(row.issued_copy_id).toBe("a1");
    expect(row.issued_copy_ref).toBe(PDF);
    expect(row.lines_missing_attachments).toBe(1);
  });

  it("takes an incoming invoice's seller as the counterparty", () => {
    const s = apply(
      utils.createDocument(),
      setHeader({ direction: "INCOMING" }),
      setSeller({ name: "Supplier Ltd" }),
      setBuyer({ name: "Sektar" }),
    ).state.global;
    expect(invoiceRow("i", s, CREATED, AT).counterparty_name).toBe("Supplier Ltd");
  });

  it("reads a v1 state through the model's upgrade", () => {
    const v1 = {
      counterparty: { name: "Old Client", contactId: null, email: null, vatId: null, address: null },
      currency: "EUR",
      direction: "OUTGOING",
      dueAt: null,
      issuedAt: null,
      lines: [{ id: "l", description: "Work", quantity: 2, unitPrice: 50, vatRate: 21 }],
      notes: null,
      number: null,
      payments: [],
      reference: null,
      status: "DRAFT",
      voidReason: null,
    };
    const s = invoiceState(v1);
    expect(s).not.toBeNull();
    const row = invoiceRow("i", s!, CREATED, AT);
    expect(row.counterparty_name).toBe("Old Client");
    expect(row.gross).toBe(121);
  });

  it("is not built from a state that is no invoice", () => {
    expect(invoiceState({ transactions: [] })).toBeNull();
  });
});

describe("parseState", () => {
  it("takes the scope's state, wrapped or not, and refuses what is not JSON", () => {
    expect(parseState('{"lines":[]}')).toEqual({ lines: [] });
    expect(parseState('{"global":{"lines":[]},"local":{}}')).toEqual({ lines: [] });
    expect(parseState("not json")).toBeNull();
    expect(parseState(undefined)).toBeNull();
  });
});

const tx = (id: string, over: Partial<Transaction> = {}): Transaction => ({
  id,
  amount: -10,
  bookedAt: "2026-10-01T00:00:00.000Z",
  category: "UNCATEGORIZED",
  contactId: null,
  counterparty: "Shop",
  description: null,
  importBatch: "b1",
  matchedDocumentId: null,
  matchedKind: null,
  reference: null,
  status: "NEW",
  ...over,
});

const account = (transactions: Transaction[], over: Partial<BankAccountState> = {}): BankAccountState => ({
  currency: "EUR",
  iban: "NL91 ABNA 0417 1643 00",
  institution: "ABN AMRO",
  kind: "CURRENT",
  lastImportedAt: "2026-10-02T00:00:00.000Z",
  name: "Main",
  openingBalance: 1000,
  transactions,
  ...over,
});

describe("an account's rows", () => {
  it("adds up the balance as accountBalance does and counts what is new", () => {
    const state = account([
      tx("t1", { amount: 250.5, status: "CATEGORIZED", category: "SALES", counterparty: "Acme BV" }),
      tx("t2", { amount: -40 }),
      tx("t3", { amount: -999, status: "EXCLUDED" }),
    ]);
    const { account: row, transactions } = accountRows("acc-1", state, AT);
    expect(row).toMatchObject({
      document_id: "acc-1",
      name: "Main",
      kind: "CURRENT",
      institution: "ABN AMRO",
      iban_last4: "4300",
      currency: "EUR",
      opening_balance: 1000,
      balance: 1000 + 250.5 - 40,
      tx_count: 3,
      new_count: 1,
      last_imported_at: "2026-10-02T00:00:00.000Z",
      updated_at: AT,
    });
    expect(transactions.map((t) => t.id)).toEqual(["t1", "t2", "t3"]);
    expect(transactions[0]).toMatchObject({
      account_id: "acc-1",
      currency: "EUR",
      category: "SALES",
      status: "CATEGORIZED",
      amount: 250.5,
    });
    expect(transactions[0].search_text).toContain("acme bv");
    expect(transactions[0].search_text).toContain("sales");
    expect(transactions[0].search_text).toContain("250.5");
  });

  it("is not built from a state that is no account", () => {
    expect(accountState({ lines: [] })).toBeNull();
    expect(accountState({ transactions: [] })).not.toBeNull();
  });
});

describe("reconciling an account's transactions", () => {
  const rows = (txs: Transaction[]) => accountRows("acc", account(txs), AT).transactions;

  it("writes everything the first time", () => {
    const truth = rows([tx("a"), tx("b")]);
    expect(diffTransactions([], truth)).toEqual({ deletes: [], upserts: truth });
  });

  it("rewrites only what changed and deletes what is gone", () => {
    const stored = rows([tx("a"), tx("b"), tx("c")]);
    const truth = rows([tx("a"), tx("b", { category: "TRAVEL", status: "CATEGORIZED" }), tx("d")]);
    const { deletes, upserts } = diffTransactions(stored, truth);
    expect(deletes).toEqual(["c"]);
    expect(upserts.map((r) => r.id)).toEqual(["b", "d"]);
  });

  it("treats a driver's numeric string as the same amount", () => {
    const stored = rows([tx("a", { amount: -12.5 })]).map((r) => ({ ...r, amount: Number("-12.5") }));
    expect(diffTransactions(stored, rows([tx("a", { amount: -12.5 })])).upserts).toEqual([]);
  });

  it("deletes every row when the account has no transactions left", () => {
    const stored = rows([tx("a"), tx("b")]);
    expect(diffTransactions(stored, [])).toEqual({ deletes: ["a", "b"], upserts: [] });
  });
});

describe("agreement with the boards' kit", () => {
  it("uses the same book currency and category labels", () => {
    expect(BOOK_CURRENCY).toBe(KIT_BOOK_CURRENCY);
    for (const [key, value] of Object.entries(CATEGORY)) {
      expect(CATEGORY_LABEL[key as keyof typeof CATEGORY_LABEL]).toBe(value.label);
    }
  });
});

describe("queries' folds", () => {
  it("splits a search into lower-cased words", () => {
    expect(searchWords("  Acme   BV ")).toEqual(["acme", "bv"]);
    expect(searchWords(null)).toEqual([]);
  });

  it("marks an OPEN invoice due before now as overdue", () => {
    const s = apply(sale(), issueInvoice({ number: "1", issuedAt: "2026-10-01T00:00:00.000Z", dueAt: "2026-10-15T00:00:00.000Z" })).state.global;
    const row = invoiceRow("i", s, CREATED, AT);
    expect(toInvoiceRow(row, "2026-10-20T00:00:00.000Z").overdue).toBe(true);
    expect(toInvoiceRow(row, "2026-10-10T00:00:00.000Z").overdue).toBe(false);
  });

  it("folds the view counts per direction", () => {
    const counts = toInvoiceCounts([
      { direction: "OUTGOING", all: "5", draft: 1, open: 2, overdue: 1, settled: 1 },
    ]);
    expect(counts.outgoing).toBe(5);
    expect(counts.incoming).toBe(0);
    expect(counts.byView).toContainEqual({ direction: "OUTGOING", view: "open", count: 2 });
    expect(counts.byView).toContainEqual({ direction: "INCOMING", view: "all", count: 0 });
    expect(toTransactionCounts(undefined)).toEqual({ all: 0, new: 0, categorised: 0, matched: 0, excluded: 0 });
  });

  it("buckets six months as the dashboard does", () => {
    expect(dashboardMonths(Date.parse("2026-03-15T00:00:00.000Z"))).toEqual([
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
  });

  it("folds the dashboard's results into its stats", () => {
    const now = Date.parse("2026-10-25T12:00:00.000Z");
    const stats = toDashboardStats(now, {
      positions: { cash: 1500, card: -200 },
      invoices: { receivable: 900, payable: "300.5", total: 4, issued: 3 },
      overdue: [],
      transactions: { total: 10, new: 4, matched: 1, sales: 2 },
      months: [{ month: "2026-10", in: 100, out: -40 }],
      spend: [
        { category: "TRAVEL", spent: -20 },
        { category: "SOFTWARE", spent: -80 },
      ],
      recent: [],
    });
    expect(stats).toMatchObject({
      bookCurrency: "EUR",
      cash: 1500,
      card: -200,
      receivable: 900,
      payable: 300.5,
      toReview: 4,
      readiness: 60,
      categorisedPct: 60,
      matchedPct: 50,
      issuedPct: 75,
    });
    expect(stats.months).toHaveLength(6);
    expect(stats.months.at(-1)).toEqual({ key: "2026-10", in: 100, out: 40 });
    expect(stats.months[0]).toEqual({ key: "2026-05", in: 0, out: 0 });
    expect(stats.spend).toEqual([
      { category: "SOFTWARE", amount: 80 },
      { category: "TRAVEL", amount: 20 },
    ]);
  });

  it("counts readiness the dashboard's way on an empty book", () => {
    const stats = toDashboardStats(Date.now(), {
      positions: undefined,
      invoices: undefined,
      overdue: [],
      transactions: undefined,
      months: [],
      spend: [],
      recent: [],
    });
    expect(stats.readiness).toBe(0);
    expect(stats.categorisedPct).toBe(100);
    expect(stats.matchedPct).toBe(100);
    expect(stats.issuedPct).toBe(100);
  });
});
