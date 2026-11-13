/**
 * What the finance index writes for an invoice and a bank account, and how
 * the dashboard folds its queries.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import type { BankAccountState, Transaction } from "document-models/bank-account";
import { utils as contactUtils, type ContactState } from "document-models/contact";
import {
  utils as expenseUtils,
  type ExpenseReportState,
} from "document-models/expense-report";
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
  CATEGORY,
  expenseReimbursable,
  expenseTotal,
  invoiceTotals,
} from "../../editors/sektar/kit/format.js";
import {
  dashboardMonths,
  searchWords,
  toDashboardStats,
  toInvoiceCounts,
  toContactRow,
  toInvoiceRow,
  toOurParty,
  toTransactionCounts,
} from "./queries.js";
import { Fx, roundMoney } from "./fx.js";
import {
  accountRows,
  accountState,
  CATEGORY_LABEL,
  contactRow,
  contactState,
  diffTransactions,
  expenseRows,
  expenseState,
  invoiceAmounts,
  invoiceRow,
  invoiceState,
  numberSortKey,
  pairRow,
  pairState,
  rateRows,
  settingsRow,
  settingsState,
  ourPartyOf,
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
      rates: "[]",
      line_count: 2,
      lines_missing_attachments: 2,
      last_paid_at: "2026-10-05T00:00:00.000Z",
      updated_at: AT,
    });
    // Agrees with the boards' own helpers to the cent.
    expect(row.gross).toBe(invoiceTotals(s).gross);
    expect(row.outstanding).toBe(invoiceTotals(s).outstanding);
    expect(row.search_text).toContain("2026010");
    expect(row.search_text).toContain("acme bv");
    expect(row.search_text).toContain("po-77");
    expect(row.search_text).toContain(String(t.gross));
  });

  it("keeps the amounts in the invoice's own currency, with the rates it carries", () => {
    const doc = apply(
      sale(),
      setCurrency({ currency: "USD" }),
      setExchangeRate({ base: "EUR", quote: "USD", rate: 1.141897 }),
    );
    const s = doc.state.global;
    const row = invoiceRow("inv-1", s, CREATED, AT);
    // nothing is converted on writing: a total converts once, on reading
    expect(row.currency).toBe("USD");
    expect(row.gross).toBe(invoiceTotals(s).gross);
    expect(JSON.parse(row.rates ?? "[]")).toEqual([
      { base: "EUR", quote: "USD", rate: 1.141897 },
    ]);
    expect(invoiceAmounts(s)).toEqual({
      gross: invoiceTotals(s).gross,
      outstanding: invoiceTotals(s).outstanding,
    });
  });

  it("converts on reading: at the invoice's own rate, else the books', else not at all", () => {
    const usd = apply(
      sale(),
      setCurrency({ currency: "USD" }),
      setExchangeRate({ base: "EUR", quote: "USD", rate: 2 }),
    ).state.global;
    const own = toInvoiceRow(invoiceRow("a", usd, CREATED, AT), AT, new Fx("EUR", []));
    expect(own.bookRateKnown).toBe(true);
    expect(own.bookGross).toBe(roundMoney(own.gross / 2));
    expect(own.gross).toBe(invoiceTotals(usd).gross);

    const sek = apply(sale(), setCurrency({ currency: "SEK" })).state.global;
    const row = invoiceRow("b", sek, CREATED, AT);
    const books = toInvoiceRow(row, AT, new Fx("EUR", [{ base: "SEK", day: "2026-10-01", rate: 0.1 }]));
    expect(books.bookRateKnown).toBe(true);
    expect(books.bookGross).toBe(roundMoney(books.gross * 0.1));

    const none = toInvoiceRow(row, AT, new Fx("EUR", []));
    expect(none.bookRateKnown).toBe(false);
    expect(none.bookGross).toBe(none.gross);

    // the books in the invoice's own currency: nothing to convert
    const same = toInvoiceRow(row, AT, new Fx("SEK", []));
    expect(same.bookRateKnown).toBe(true);
    expect(same.bookOutstanding).toBe(same.outstanding);
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
  bankBalance: null,
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

  it("lists a pending transaction without counting it in the balance or the review", () => {
    const state = account([tx("t1", { amount: -40 }), tx("p1", { amount: -12.5, status: "PENDING" })]);
    const { account: row, transactions } = accountRows("acc-1", state, AT);
    expect(row).toMatchObject({ balance: 1000 - 40, tx_count: 2, new_count: 1 });
    expect(transactions.find((t) => t.id === "p1")?.status).toBe("PENDING");
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
  it("uses the same category labels", () => {
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
    const fx = new Fx("EUR", []);
    expect(toInvoiceRow(row, "2026-10-20T00:00:00.000Z", fx).overdue).toBe(true);
    expect(toInvoiceRow(row, "2026-10-10T00:00:00.000Z", fx).overdue).toBe(false);
  });

  it("folds the view counts per direction", () => {
    const counts = toInvoiceCounts([
      { direction: "OUTGOING", all: "5", draft: 1, open: 2, overdue: 1, settled: 1 },
    ]);
    expect(counts.outgoing).toBe(5);
    expect(counts.incoming).toBe(0);
    expect(counts.byView).toContainEqual({ direction: "OUTGOING", view: "open", count: 2 });
    expect(counts.byView).toContainEqual({ direction: "INCOMING", view: "all", count: 0 });
    expect(toTransactionCounts(undefined)).toEqual({ all: 0, new: 0, categorised: 0, matched: 0, excluded: 0, pending: 0 });
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
      positions: [{ currency: "EUR", cash: 1500, card: -200 }],
      open: [
        { direction: "OUTGOING", currency: "EUR", outstanding: 900, rates: "[]" },
        { direction: "INCOMING", currency: "EUR", outstanding: "300.5", rates: "[]" },
      ],
      invoices: { total: 4, issued: 3 },
      overdue: [],
      transactions: { total: 10, new: 4, matched: 1, sales: 2 },
      months: [
        { day: "2026-10-03", currency: "EUR", in: 60, out: -40 },
        { day: "2026-10-20", currency: "EUR", in: 40, out: 0 },
      ],
      spend: [
        { category: "TRAVEL", day: "2026-10-03", currency: "EUR", spent: -20 },
        { category: "SOFTWARE", day: "2026-10-03", currency: "EUR", spent: -50 },
        { category: "SOFTWARE", day: "2026-10-04", currency: "EUR", spent: -30 },
      ],
      recent: [],
    });
    expect(stats).toMatchObject({
      bookCurrency: "EUR",
      unconverted: [],
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

  it("converts every total once: positions at the latest rate, flows at the day's", () => {
    const now = Date.parse("2026-10-25T12:00:00.000Z");
    const fx = new Fx("EUR", [
      { base: "USD", day: "2026-10-01", rate: 0.5 },
      { base: "USD", day: "2026-10-10", rate: 0.8 },
    ]);
    const stats = toDashboardStats(
      now,
      {
        positions: [
          { currency: "EUR", cash: 1000, card: -100 },
          { currency: "USD", cash: 1000, card: -50 },
          { currency: "CHF", cash: 999, card: 0 },
        ],
        open: [
          { direction: "OUTGOING", currency: "USD", outstanding: 100, rates: "[]" },
          // its own rate wins over the books'
          { direction: "OUTGOING", currency: "USD", outstanding: 100, rates: '[{"base":"USD","quote":"EUR","rate":0.9}]' },
          { direction: "INCOMING", currency: "EUR", outstanding: 40, rates: "[]" },
          { direction: "INCOMING", currency: "JPY", outstanding: 5000, rates: "[]" },
        ],
        invoices: { total: 4, issued: 4 },
        overdue: [],
        transactions: undefined,
        months: [
          { day: "2026-10-02", currency: "USD", in: 100, out: -10 },
          { day: "2026-10-12", currency: "USD", in: 100, out: 0 },
          { day: "2026-10-12", currency: "EUR", in: 5, out: 0 },
          { day: "2026-10-12", currency: "CHF", in: 777, out: -777 },
        ],
        spend: [
          { category: "TRAVEL", day: "2026-10-02", currency: "USD", spent: -100 },
          { category: "TRAVEL", day: "2026-10-12", currency: "USD", spent: -100 },
          { category: "RENT", day: "2026-10-12", currency: "CHF", spent: -500 },
        ],
        recent: [],
      },
      fx,
    );
    // 1000 + 1000 * 0.8; the francs have no rate and are left out, named
    expect(stats.cash).toBe(1800);
    expect(stats.card).toBe(-140);
    expect(stats.receivable).toBe(170);
    expect(stats.payable).toBe(40);
    expect(stats.unconverted).toEqual(["CHF", "JPY"]);
    // 100 * 0.5 + 100 * 0.8 + 5
    expect(stats.months.at(-1)).toEqual({ key: "2026-10", in: 135, out: 5 });
    expect(stats.spend).toEqual([{ category: "TRAVEL", amount: 130 }]);
  });

  it("keeps the six largest categories of spend", () => {
    const spend = ["A", "B", "C", "D", "E", "F", "G"].map((category, i) => ({
      category,
      day: "2026-10-02",
      currency: "EUR",
      spent: -(i + 1),
    }));
    const stats = toDashboardStats(Date.parse("2026-10-25T12:00:00.000Z"), {
      positions: [],
      open: [],
      invoices: undefined,
      overdue: [],
      transactions: undefined,
      months: [],
      spend,
      recent: [],
    });
    expect(stats.spend.map((s) => s.category)).toEqual(["G", "F", "E", "D", "C", "B"]);
  });

  it("counts readiness the dashboard's way on an empty book", () => {
    const stats = toDashboardStats(Date.now(), {
      positions: [],
      open: [],
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

/* ------------------------------------------------- claims, contacts, ours */

const claim = (over: Partial<ExpenseReportState> = {}): ExpenseReportState => ({
  ...expenseUtils.createDocument().state.global,
  title: "Berlin trip",
  submitter: { name: "Mila Jansen", email: "mila@juniper.studio" },
  status: "SUBMITTED",
  currency: "EUR",
  items: [
    {
      id: "i1",
      spentAt: "2026-10-03T00:00:00.000Z",
      merchant: "Deutsche Bahn",
      category: "TRAVEL",
      amount: 120.4,
      vatAmount: 7.88,
      paidWith: "PERSONAL",
      receiptName: null,
      note: null,
      contactId: null,
    },
    {
      id: "i2",
      spentAt: "2026-10-04T00:00:00.000Z",
      merchant: "Hotel Adlon",
      category: "TRAVEL",
      amount: 310.15,
      vatAmount: 20.3,
      paidWith: "COMPANY_CARD",
      receiptName: null,
      note: null,
      contactId: null,
    },
    {
      id: "i3",
      spentAt: "2026-10-04T00:00:00.000Z",
      merchant: "Kiosk",
      category: "OTHER",
      amount: 4.2,
      vatAmount: 0,
      paidWith: "CASH",
      receiptName: null,
      note: null,
      contactId: null,
    },
  ],
  ...over,
});

describe("a claim's rows", () => {
  it("adds up as the board does and keeps every receipt", () => {
    const state = claim();
    const { report, items } = expenseRows("exp-1", state, CREATED, AT);
    expect(report).toMatchObject({
      document_id: "exp-1",
      title: "Berlin trip",
      submitter_name: "Mila Jansen",
      submitter_email: "mila@juniper.studio",
      status: "SUBMITTED",
      currency: "EUR",
      total: expenseTotal(state),
      reimbursable: expenseReimbursable(state),
      vat_total: 28.18,
      item_count: 3,
      categories: "TRAVEL,OTHER",
      first_spent_at: "2026-10-03T00:00:00.000Z",
      created_at: CREATED,
      updated_at: AT,
    });
    expect(report.search_text).toContain("hotel adlon");
    expect(report.search_text).toContain("mila jansen");
    expect(items.map((i) => [i.report_id, i.id, i.amount, i.paid_with])).toEqual([
      ["exp-1", "i1", 120.4, "PERSONAL"],
      ["exp-1", "i2", 310.15, "COMPANY_CARD"],
      ["exp-1", "i3", 4.2, "CASH"],
    ]);
  });

  it("has no first date and no categories without receipts", () => {
    const { report, items } = expenseRows("exp-2", claim({ items: [] }), CREATED, AT);
    expect(report).toMatchObject({ total: 0, item_count: 0, categories: "", first_spent_at: null });
    expect(items).toEqual([]);
  });

  it("is not built from a state that is no claim", () => {
    expect(expenseState({ items: [] })).toBeNull();
    expect(expenseState({ ...claim() })).not.toBeNull();
  });
});

describe("a contact's row", () => {
  it("takes what the board, the pickers and the invoice party need", () => {
    const state: ContactState = {
      ...contactUtils.createDocument().state.global,
      name: "Maple & Finch",
      kind: "CUSTOMER",
      email: "hello@maple.nl",
      vatId: "NL123",
      registrationNumber: "KVK 55",
      address: { street: "Keizersgracht 1", postalCode: "1015", city: "Amsterdam", country: "NL" },
      paymentTermsDays: 14,
      defaultCategory: "SALES",
      tags: ["retainer", "photo"],
    };
    const row = contactRow("c-1", state, AT);
    expect(row).toMatchObject({
      document_id: "c-1",
      name: "Maple & Finch",
      kind: "CUSTOMER",
      status: "ACTIVE",
      email: "hello@maple.nl",
      vat_id: "NL123",
      registration_number: "KVK 55",
      street: "Keizersgracht 1",
      postal_code: "1015",
      city: "Amsterdam",
      country: "NL",
      payment_terms_days: 14,
      default_category: "SALES",
      updated_at: AT,
    });
    expect(JSON.parse(row.tags)).toEqual(["retainer", "photo"]);
    expect(row.search_text).toContain("amsterdam");
    expect(row.search_text).toContain("retainer");
    expect(toContactRow(row)).toMatchObject({ id: "c-1", tags: ["retainer", "photo"], openInvoiceCount: 0 });
  });

  it("is not built from a state that is no contact", () => {
    expect(contactState({ tags: [] })).toBeNull();
    expect(contactState({ ...contactUtils.createDocument().state.global })).not.toBeNull();
  });
});

describe("our side of an invoice", () => {
  it("is the seller of a sale and the buyer of a bill, without the contact link", () => {
    const party = ourPartyOf(sale().state.global);
    expect(party && toOurParty(party)).toMatchObject({ name: "Sektar", street: null });
    expect(party).not.toContain("contactId");
    const bill = apply(
      utils.createDocument(),
      setHeader({ direction: "INCOMING" }),
      setBuyer({ name: "Juniper Studio", contactId: "me", vatId: "NL999" }),
      setSeller({ name: "Supplier" }),
    );
    expect(toOurParty(ourPartyOf(bill.state.global))).toMatchObject({ name: "Juniper Studio", vatId: "NL999" });
  });

  it("is null while our side has no name", () => {
    const draft = apply(utils.createDocument(), setHeader({ direction: "OUTGOING" }));
    expect(ourPartyOf(draft.state.global)).toBeNull();
    expect(toOurParty(null)).toBeNull();
    expect(toOurParty("not json")).toBeNull();
  });

  it("is on the invoice's row", () => {
    expect(invoiceRow("inv-1", sale().state.global, CREATED, AT).our_party).toBe(
      ourPartyOf(sale().state.global),
    );
  });
});

describe("the books' settings and rates", () => {
  it("reads the main currency off a settings document", () => {
    const state = settingsState({ baseCurrency: "USD", baseCurrencyChangedAt: null });
    expect(state).not.toBeNull();
    expect(settingsRow("set-1", state!, CREATED, AT)).toEqual({
      document_id: "set-1",
      base_currency: "USD",
      created_at: CREATED,
      updated_at: AT,
    });
    // a state with no currency is the model's default
    expect(settingsRow("set-1", { baseCurrency: "", baseCurrencyChangedAt: null }, CREATED, AT).base_currency).toBe("EUR");
    expect(settingsState({ rates: [] })).toBeNull();
  });

  it("writes one row per day of a named pair", () => {
    const state = pairState({
      base: "USD",
      quote: "EUR",
      lastFetchedAt: null,
      rates: [
        { id: "r1", date: "2026-11-10T00:00:00.000Z", rate: 0.9, source: "ECB", manual: false },
        { id: "r2", date: "2026-11-11T00:00:00.000Z", rate: 0.8, source: "Manual", manual: true },
        // not a day, not a rate: no row
        { id: "r3", date: "soon", rate: 0.7, source: null, manual: false },
        { id: "r4", date: "2026-11-12T00:00:00.000Z", rate: 0, source: null, manual: false },
      ],
    });
    expect(state).not.toBeNull();
    expect(rateRows("pair-1", state!)).toEqual([
      { pair_id: "pair-1", base: "USD", quote: "EUR", day: "2026-11-10", rate: 0.9 },
      { pair_id: "pair-1", base: "USD", quote: "EUR", day: "2026-11-11", rate: 0.8 },
    ]);
    expect(pairRow("pair-1", { ...state!, lastFetchedAt: AT }, CREATED, AT)).toEqual({
      document_id: "pair-1",
      base: "USD",
      quote: "EUR",
      rate_count: 2,
      first_day: "2026-11-10",
      last_day: "2026-11-11",
      last_rate: 0.8,
      last_source: "Manual",
      last_fetched_at: AT,
      created_at: CREATED,
      updated_at: AT,
    });
  });

  it("writes nothing for a pair without its currencies, or a state that is not a pair", () => {
    const unnamed = pairState({ base: null, quote: null, lastFetchedAt: null, rates: [] });
    expect(unnamed).not.toBeNull();
    expect(rateRows("pair-1", unnamed!)).toEqual([]);
    expect(pairRow("pair-1", unnamed!, CREATED, AT)).toMatchObject({
      base: null,
      quote: null,
      rate_count: 0,
      first_day: null,
      last_day: null,
      last_rate: null,
      last_source: null,
      last_fetched_at: null,
    });
    expect(pairState({ rates: "none" })).toBeNull();
    expect(pairState({ rates: [] })).toBeNull();
  });
});
