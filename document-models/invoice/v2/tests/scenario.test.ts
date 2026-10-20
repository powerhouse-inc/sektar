import {
  addAttachment,
  addLine,
  addPrecedingInvoice,
  computeTotals,
  findRate,
  issueInvoice,
  lineNet,
  moveAttachment,
  moveLine,
  recordPayment,
  reducer,
  removeAttachment,
  removeExchangeRate,
  removeLine,
  removePayment,
  removePrecedingInvoice,
  removeVatReason,
  round2,
  setBuyer,
  setCurrency,
  setExchangeRate,
  setHeader,
  setPaymentInstructions,
  setSeller,
  setVatReason,
  updateAttachment,
  updateLine,
  utils,
  voidInvoice,
  type InvoiceDocument,
} from "document-models/invoice/v2";
import { describe, expect, it } from "vitest";

const AT = "2026-03-31T00:00:00.000Z";
const PDF = "attachment://v1:5311d387c1e9d56010dd23e5d04dbadb8d69b95e0a5996cbd4bffb14d0fc494f" as const;
const RECEIPT = "attachment://v1:0663769596ac8296eac18e061a5c5c90800022de3919cd10080214d2753c4f17" as const;

type Action = Parameters<typeof reducer>[1];
const apply = (doc: InvoiceDocument, ...actions: Action[]) =>
  actions.reduce((d, a) => reducer(d, a), doc);
/** The error of the last operation, or undefined when it applied. */
const lastError = (doc: InvoiceDocument) => doc.operations.global.at(-1)?.error;
/** Applies one action that must fail, and checks the state did not move. */
function rejects(doc: InvoiceDocument, action: Action, message: RegExp) {
  const before = JSON.stringify(doc.state.global);
  const next = reducer(doc, action);
  expect(lastError(next)).toMatch(message);
  expect(JSON.stringify(next.state.global)).toBe(before);
  return next;
}

const line = (id: string, over: Partial<Parameters<typeof addLine>[0]> = {}) =>
  addLine({
    id,
    description: "Consultancy",
    quantity: 1,
    unitPrice: 100,
    vatCategory: "STANDARD",
    vatRate: 21,
    ...over,
  });

describe("forward billing in USD, VAT reported in EUR", () => {
  it("re-bills EUR costs at the month's rate, with receipts per line and the PDF on the invoice", () => {
    let doc = utils.createDocument();
    expect(doc.state.global.kind).toBe("INVOICE");
    expect(doc.state.global.currency).toBe("EUR");

    doc = apply(
      doc,
      setHeader({
        subject: "  Powerhouse expenses, January 2026 ",
        deliveredAt: "2026-01-31T00:00:00.000Z",
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-01-31T00:00:00.000Z",
        paymentTerms: "30 days",
        buyerReference: "PH-EXP",
        orderReference: "PO-7",
        contractReference: "MSA-2025",
        projectReference: "Powerhouse",
        notes: "",
        roundingAmount: 0,
      }),
      setSeller({
        name: "KSDC bv",
        vatId: "be 0545.965.488",
        registrationId: "0545965488",
        registrationScheme: "0208",
        endpointId: "0545965488",
        endpointScheme: "0208",
        email: "contact@ksdc.be",
        phone: "+32 474 685 373",
        street: "Denise de Weerdtpad 12/401",
        additionalStreet: "",
        postalCode: "9000",
        city: "Gent",
        region: null,
        country: "be",
      }),
      setBuyer({
        name: "Powerhouse Genesis",
        registrationId: "CHE-290.454.155",
        registrationScheme: "0183",
        street: "Bahnhofstrasse 20",
        postalCode: "6300",
        city: "Zug",
        country: "CH",
        contactId: "contact-ph",
      }),
      setCurrency({ currency: "usd", vatCurrency: "eur" }),
      setExchangeRate({ base: "eur", quote: "usd", rate: 1.173094, date: AT, source: " ECB " }),
      setPaymentInstructions({
        meansCode: "58",
        meansText: "SEPA credit transfer",
        account: "be40 7370 4138 2263",
        accountName: "KSDC bv",
        bic: "kredbebb",
        remittance: "2026002",
      }),
      line("toggl", {
        description: "Software - Toggl",
        unitPrice: 0,
        vatCategory: "REVERSE_CHARGE",
        vatRate: 0,
        category: "Software",
        originalAmount: 185.13,
        originalCurrency: "eur",
      }),
      line("heroku", {
        description: "Software - Heroku",
        unitPrice: 217.17,
        vatCategory: "REVERSE_CHARGE",
        vatRate: 0,
        category: "Software",
        periodStart: "2026-01-01T00:00:00.000Z",
        note: "USD receipt, no conversion",
      }),
    );
    expect(lastError(doc)).toBeUndefined();
    const s = doc.state.global;
    expect(s.subject).toBe("Powerhouse expenses, January 2026");
    expect(s.period).toEqual({ start: "2026-01-01T00:00:00.000Z", end: "2026-01-31T00:00:00.000Z" });
    expect(s.references).toEqual({
      buyerReference: "PH-EXP",
      orderReference: "PO-7",
      contractReference: "MSA-2025",
      projectReference: "Powerhouse",
    });
    expect(s.notes).toBeNull();
    expect(s.roundingAmount).toBeNull();
    expect(s.seller.vatId).toBe("BE0545.965.488");
    expect(s.seller.country).toBe("BE");
    expect(s.seller.additionalStreet).toBeNull();
    expect(s.buyer.contactId).toBe("contact-ph");
    expect(s.currency).toBe("USD");
    expect(s.vatCurrency).toBe("EUR");
    expect(s.exchangeRates).toEqual([
      { base: "EUR", quote: "USD", rate: 1.173094, date: AT, source: "ECB" },
    ]);
    expect(s.paymentInstructions).toEqual({
      meansCode: "58",
      meansText: "SEPA credit transfer",
      account: "BE40737041382263",
      accountName: "KSDC bv",
      bic: "KREDBEBB",
      remittance: "2026002",
    });
    // The EUR cost is converted at the invoice's rate: 185.13 EUR × 1.173094 = 217.17 USD.
    expect(s.lines[0].original).toEqual({ amount: 185.13, currency: "EUR", rate: null });
    expect(s.lines[0].unitPrice).toBe(217.17);
    expect(s.lines[0].unitCode).toBe("C62");
    expect(s.lines[1].period).toEqual({ start: "2026-01-01T00:00:00.000Z", end: null });

    // A better rate re-prices every line that follows the invoice's rate.
    doc = apply(doc, setExchangeRate({ base: "USD", quote: "EUR", rate: 0.85 }));
    expect(doc.state.global.exchangeRates).toHaveLength(1);
    expect(doc.state.global.lines[0].unitPrice).toBe(round2(185.13 / 0.85));
    // A line can carry its own rate (a card statement's), which then wins.
    doc = apply(doc, updateLine({ id: "toggl", originalRate: 1.2 }));
    expect(doc.state.global.lines[0].unitPrice).toBe(222.16);
    doc = apply(doc, updateLine({ id: "toggl", originalRate: null, originalAmount: 100 }));
    expect(doc.state.global.lines[0].unitPrice).toBe(round2(100 / 0.85));
    // Without a rate for the pair, the price stays as it was.
    doc = apply(doc, removeExchangeRate({ base: "eur", quote: "usd" }));
    const kept = doc.state.global.lines[0].unitPrice;
    doc = apply(doc, setCurrency({ currency: "GBP" }));
    expect(doc.state.global.lines[0].unitPrice).toBe(kept);
    doc = apply(
      doc,
      setCurrency({ currency: "USD", vatCurrency: null }),
      setCurrency({ vatCurrency: "EUR" }),
      setExchangeRate({ base: "EUR", quote: "USD", rate: 1.173094 }),
      updateLine({ id: "toggl", originalAmount: 185.13 }),
    );
    expect(doc.state.global.lines[0].unitPrice).toBe(217.17);

    // Exemption reasons per category; the reverse charge needs one.
    doc = apply(
      doc,
      setVatReason({ category: "REVERSE_CHARGE", code: "vatex-eu-ae", text: " BTW verlegd / VAT reverse charge " }),
      setVatReason({ category: "REVERSE_CHARGE", code: "VATEX-EU-AE", text: "VAT reverse charge" }),
      setVatReason({ category: "EXEMPT", code: null, text: "Exempt, art. 44 VAT Code" }),
      removeVatReason({ category: "EXEMPT" }),
    );
    expect(doc.state.global.vatReasons).toEqual([
      { category: "REVERSE_CHARGE", code: "VATEX-EU-AE", text: "VAT reverse charge" },
    ]);

    // Receipts on the line, the PDF on the invoice.
    doc = apply(
      doc,
      addAttachment({
        id: "receipt",
        lineId: "toggl",
        role: "RECEIPT",
        fileName: " Invoice-TOGGL-2066546.pdf ",
        mimeType: "Application/PDF",
        ref: RECEIPT,
        sizeBytes: 31282,
        description: " Toggl, January ",
        addedAt: AT,
      }),
      addAttachment({
        id: "pdf",
        role: "ISSUED_COPY",
        fileName: "2026002-ph-january.pdf",
        mimeType: "application/pdf",
        ref: PDF,
        addedAt: AT,
      }),
      addAttachment({
        id: "zip",
        role: "SUPPORTING",
        fileName: "2026002-supporting-materials.zip",
        mimeType: "application/zip",
        url: "https://example.com/2026002.zip",
        documentId: "file-doc",
        addedAt: AT,
      }),
    );
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global.lines[0].attachments).toEqual([
      {
        id: "receipt",
        role: "RECEIPT",
        fileName: "Invoice-TOGGL-2066546.pdf",
        mimeType: "application/pdf",
        ref: RECEIPT,
        sizeBytes: 31282,
        description: "Toggl, January",
        url: null,
        documentId: null,
        addedAt: AT,
      },
    ]);
    expect(doc.state.global.attachments.map((a) => a.id)).toEqual(["pdf", "zip"]);

    // Totals the EN 16931 way; the VAT in EUR is zero for a reverse charge.
    let t = computeTotals(doc.state.global);
    expect(t.net).toBe(434.34);
    expect(t.vat).toBe(0);
    expect(t.gross).toBe(434.34);
    expect(t.due).toBe(434.34);
    expect(t.vatInVatCurrency).toBe(0);
    expect(t.groups).toEqual([{ category: "REVERSE_CHARGE", rate: 0, taxable: 434.34, tax: 0 }]);

    // Issue: the number and dates are fixed, attachments stay open.
    doc = apply(
      doc,
      moveLine({ id: "heroku", index: 0 }),
      issueInvoice({ number: " 2026002 ", issuedAt: AT, dueAt: "2026-04-30T00:00:00.000Z" }),
    );
    expect(doc.state.global.status).toBe("OPEN");
    expect(doc.state.global.number).toBe("2026002");
    expect(doc.state.global.lines.map((l) => l.id)).toEqual(["heroku", "toggl"]);
    doc = apply(
      doc,
      setHeader({ dueAt: "2026-05-15T00:00:00.000Z", notes: "Extended by mail", paymentTerms: null }),
      updateAttachment({ id: "receipt", role: "SUPPORTING", fileName: " renamed.pdf ", description: null, url: null, documentId: "file-receipt" }),
      updateAttachment({ id: "zip", fileName: "" }),
      moveAttachment({ id: "receipt", lineId: null }),
      moveAttachment({ id: "receipt", lineId: "heroku" }),
      removeAttachment({ id: "zip" }),
    );
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global.dueAt).toBe("2026-05-15T00:00:00.000Z");
    expect(doc.state.global.paymentTerms).toBeNull();
    expect(doc.state.global.lines[0].attachments[0]).toMatchObject({
      id: "receipt",
      role: "SUPPORTING",
      fileName: "renamed.pdf",
      description: null,
      documentId: "file-receipt",
    });
    expect(doc.state.global.attachments.map((a) => a.id)).toEqual(["pdf"]);

    // Paid in two parts; a payment recorded by mistake opens it again.
    doc = apply(
      doc,
      recordPayment({ id: "p1", paidAt: AT, amount: 400, method: "BANK_TRANSFER", transactionId: " tx-1 " }),
    );
    expect(doc.state.global.status).toBe("OPEN");
    doc = apply(doc, recordPayment({ id: "p2", paidAt: AT, amount: 34.34, method: "BANK_TRANSFER" }));
    expect(doc.state.global.status).toBe("PAID");
    expect(doc.state.global.payments.map((p) => p.transactionId)).toEqual(["tx-1", null]);
    t = computeTotals(doc.state.global);
    expect(t.paid).toBe(434.34);
    expect(t.due).toBe(0);
    doc = apply(doc, removePayment({ id: "p2" }));
    expect(doc.state.global.status).toBe("OPEN");
    doc = apply(doc, recordPayment({ id: "p3", paidAt: AT, amount: 40, method: "CARD" }), removePayment({ id: "p1" }));
    expect(doc.state.global.status).toBe("OPEN");
  });
});

describe("a credit note", () => {
  it("corrects an invoice: it references it, and voids when it was a mistake", () => {
    let doc = apply(
      utils.createDocument(),
      setHeader({ kind: "CREDIT_NOTE", direction: "OUTGOING" }),
      addPrecedingInvoice({ id: "ref", number: " 2014013 ", issuedAt: AT, documentId: "inv-2014013" }),
      addPrecedingInvoice({ id: "ref2", number: "2014014" }),
      removePrecedingInvoice({ id: "ref2" }),
      line("fix", { description: "Correction of invoice 2014013", unitPrice: 2900 }),
      line("discount", { description: "Goodwill", quantity: -1, unitPrice: 100, position: 0 }),
      line("first", { position: -5 }),
      removeLine({ id: "first" }),
    );
    expect(lastError(doc)).toBeUndefined();
    const s = doc.state.global;
    expect(s.kind).toBe("CREDIT_NOTE");
    expect(s.precedingInvoices).toEqual([
      { id: "ref", number: "2014013", issuedAt: AT, documentId: "inv-2014013" },
    ]);
    expect(s.lines.map((l) => l.id)).toEqual(["discount", "fix"]);
    const t = computeTotals(s);
    expect(t.net).toBe(2800);
    expect(t.vat).toBe(588);
    expect(t.gross).toBe(3388);
    expect(t.vatInVatCurrency).toBeNull();

    doc = apply(doc, voidInvoice({ reason: "  " }));
    expect(doc.state.global.status).toBe("VOID");
    expect(doc.state.global.voidReason).toBeNull();
  });
});

describe("totals", () => {
  it("rounds each line before summing, and groups VAT per category and rate", () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
    expect(lineNet({ quantity: 3, unitPrice: 0.333 })).toBe(1);
    expect(findRate([], "EUR", "EUR")).toBe(1);
    expect(findRate([{ base: "EUR", quote: "USD", rate: 2, date: null, source: null }], "USD", "EUR")).toBe(0.5);
    expect(findRate([], "EUR", "USD")).toBeNull();
    const doc = apply(
      utils.createDocument(),
      line("a", { quantity: 3, unitPrice: 0.333 }),
      line("b", { unitPrice: 10, vatRate: 6 }),
      line("c", { unitPrice: 5, vatCategory: "EXEMPT", vatRate: 0 }),
      setCurrency({ vatCurrency: "USD" }),
      setHeader({ roundingAmount: -0.01 }),
    );
    const t = computeTotals(doc.state.global);
    expect(t.groups).toEqual([
      { category: "STANDARD", rate: 21, taxable: 1, tax: 0.21 },
      { category: "STANDARD", rate: 6, taxable: 10, tax: 0.6 },
      { category: "EXEMPT", rate: 0, taxable: 5, tax: 0 },
    ]);
    expect(t.gross).toBe(16.81);
    expect(t.rounding).toBe(-0.01);
    expect(t.due).toBe(16.8);
    // No EUR→USD rate yet: the VAT in USD is unknown, not zero.
    expect(t.vatInVatCurrency).toBeNull();
  });
});

describe("what the reducers refuse", () => {
  it("refuses changes that break a rule, and leaves the state as it was", () => {
    let doc = apply(utils.createDocument(), line("l1"));

    // header
    doc = rejects(doc, setHeader({ periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-01-01T00:00:00.000Z" }), /ends before it starts/);
    doc = rejects(doc, removePrecedingInvoice({ id: "nope" }), /No such reference/);
    doc = apply(doc, addPrecedingInvoice({ id: "r", number: "1" }));
    doc = rejects(doc, addPrecedingInvoice({ id: "r", number: "2" }), /already used/);
    // currency
    doc = rejects(doc, setCurrency({ currency: "euro" }), /ISO 4217/);
    doc = rejects(doc, setCurrency({ vatCurrency: "eu" }), /ISO 4217/);
    doc = rejects(doc, setCurrency({ vatCurrency: "EUR" }), /differs/);
    doc = rejects(doc, setExchangeRate({ base: "EUR", quote: "EUR", rate: 1 }), /two different/);
    doc = rejects(doc, setExchangeRate({ base: "EUR", quote: "USD", rate: 0 }), /positive/);
    doc = rejects(doc, removeExchangeRate({ base: "EUR", quote: "USD" }), /No rate/);
    // lines
    doc = rejects(doc, line("l1"), /already used/);
    doc = rejects(doc, line("x", { description: " " }), /needs a description/);
    doc = rejects(doc, line("x", { quantity: 0 }), /other than zero/);
    doc = rejects(doc, line("x", { unitPrice: -1 }), /negative quantity/);
    doc = rejects(doc, line("x", { unitCode: "hours" }), /UN\/ECE/);
    doc = rejects(doc, line("x", { vatRate: 101 }), /percentage/);
    doc = rejects(doc, line("x", { vatRate: 0 }), /rate above zero/);
    doc = rejects(doc, line("x", { vatCategory: "EXEMPT" }), /Exempt lines carry no VAT/);
    doc = rejects(doc, line("x", { periodStart: "2026-02-01T00:00:00.000Z", periodEnd: "2026-01-01T00:00:00.000Z" }), /ends before/);
    doc = rejects(doc, line("x", { originalAmount: 5 }), /amount and a currency/);
    doc = rejects(doc, line("x", { originalAmount: -5, originalCurrency: "EUR" }), /cannot be negative/);
    doc = rejects(doc, line("x", { originalAmount: 5, originalCurrency: "EURO" }), /ISO 4217/);
    doc = rejects(doc, line("x", { originalAmount: 5, originalCurrency: "USD", originalRate: -1 }), /must be positive/);
    doc = rejects(doc, updateLine({ id: "nope" }), /No such line/);
    doc = rejects(doc, updateLine({ id: "l1", originalRate: 2 }), /amount and a currency/);
    doc = rejects(doc, updateLine({ id: "l1", quantity: 0 }), /other than zero/);
    doc = rejects(doc, removeLine({ id: "nope" }), /No such line/);
    doc = rejects(doc, moveLine({ id: "nope", index: 0 }), /No such line/);
    doc = apply(
      doc,
      updateLine({
        id: "l1",
        description: " Hours ",
        note: " n ",
        unitCode: "hur",
        unitPrice: 90,
        quantity: 2,
        vatCategory: "STANDARD",
        vatRate: 6,
        category: " Work ",
        periodStart: AT,
        periodEnd: null,
        originalAmount: 50,
        originalCurrency: "eur",
      }),
      updateLine({ id: "l1", unitCode: null, periodStart: null, originalAmount: null }),
    );
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global.lines[0]).toMatchObject({
      description: "Hours",
      note: "n",
      unitCode: "C62",
      // The 50 EUR original priced the line; clearing it keeps that price.
      unitPrice: 50,
      quantity: 2,
      vatRate: 6,
      category: "Work",
      period: null,
      original: null,
    });
    // vat
    doc = rejects(doc, setVatReason({ category: "STANDARD", code: "VATEX-EU-AE" }), /take no exemption/);
    doc = rejects(doc, setVatReason({ category: "EXEMPT", code: " ", text: null }), /needs a VATEX code/);
    doc = rejects(doc, removeVatReason({ category: "EXEMPT" }), /No reason/);
    // payment instructions keep a non-IBAN account as given
    doc = apply(doc, setPaymentInstructions({ account: "0x6FEB dBD8", meansCode: null }));
    expect(doc.state.global.paymentInstructions.account).toBe("0x6FEB dBD8");
    // attachments
    const att = (over: Partial<Parameters<typeof addAttachment>[0]> = {}) =>
      addAttachment({ id: "a", role: "OTHER", fileName: "f.pdf", mimeType: "application/pdf", ref: PDF, addedAt: AT, ...over });
    doc = rejects(doc, att({ lineId: "nope" }), /No such line/);
    doc = rejects(doc, att({ fileName: " " }), /file name and a type/);
    doc = rejects(doc, att({ ref: null }), /stored bytes, a URL or a document/);
    doc = apply(doc, att());
    doc = rejects(doc, att(), /already used/);
    doc = rejects(doc, updateAttachment({ id: "nope" }), /No such attachment/);
    doc = rejects(doc, removeAttachment({ id: "nope" }), /No such attachment/);
    doc = rejects(doc, moveAttachment({ id: "nope" }), /No such attachment/);
    doc = rejects(doc, moveAttachment({ id: "a", lineId: "nope" }), /No such line/);
    // lifecycle
    doc = rejects(doc, recordPayment({ id: "p", paidAt: AT, amount: 1, method: "CASH" }), /open invoices only/);
    doc = rejects(doc, removePayment({ id: "nope" }), /No such payment/);
    doc = rejects(doc, issueInvoice({ number: "  ", issuedAt: AT }), /needs a number/);
    const empty = rejects(utils.createDocument(), issueInvoice({ number: "1", issuedAt: AT }), /at least one line/);
    expect(empty.state.global.status).toBe("DRAFT");

    doc = apply(doc, issueInvoice({ number: "2026009", issuedAt: AT }));
    expect(doc.state.global.dueAt).toBeNull();
    // Once issued, what was invoiced is fixed.
    doc = rejects(doc, setHeader({ subject: "Changed" }), /subject is fixed/);
    doc = rejects(doc, addPrecedingInvoice({ id: "r2", number: "3" }), /fixed once/);
    doc = rejects(doc, removePrecedingInvoice({ id: "r" }), /fixed once/);
    doc = rejects(doc, setSeller({ name: "Other" }), /fixed once/);
    doc = rejects(doc, setBuyer({ name: "Other" }), /fixed once/);
    doc = rejects(doc, setCurrency({ currency: "USD" }), /fixed once/);
    doc = rejects(doc, setExchangeRate({ base: "EUR", quote: "USD", rate: 1.1 }), /fixed once/);
    doc = rejects(doc, removeExchangeRate({ base: "EUR", quote: "USD" }), /fixed once/);
    doc = rejects(doc, line("l2"), /only change on a draft/);
    doc = rejects(doc, updateLine({ id: "l1", quantity: 3 }), /only change on a draft/);
    doc = rejects(doc, removeLine({ id: "l1" }), /only change on a draft/);
    doc = rejects(doc, moveLine({ id: "l1", index: 0 }), /only change on a draft/);
    doc = rejects(doc, setVatReason({ category: "EXEMPT", text: "x" }), /fixed once/);
    doc = rejects(doc, removeVatReason({ category: "EXEMPT" }), /fixed once/);
    doc = rejects(doc, setPaymentInstructions({ bic: "X" }), /fixed once/);
    doc = rejects(doc, issueInvoice({ number: "2", issuedAt: AT }), /Only a draft/);
    doc = rejects(doc, recordPayment({ id: "p", paidAt: AT, amount: 0, method: "CASH" }), /must be positive/);
    doc = apply(doc, recordPayment({ id: "p", paidAt: AT, amount: 1, method: "CASH" }));
    doc = rejects(doc, recordPayment({ id: "p", paidAt: AT, amount: 1, method: "CASH" }), /already used/);
    doc = apply(doc, recordPayment({ id: "p2", paidAt: AT, amount: 1000, method: "CASH" }));
    expect(doc.state.global.status).toBe("PAID");
    doc = rejects(doc, setHeader({ notes: "late" }), /paid or void/);
    doc = rejects(doc, voidInvoice({ reason: "x" }), /paid invoice cannot be voided/);
    doc = apply(doc, removePayment({ id: "p2" }), voidInvoice({ reason: " Sent twice " }));
    expect(doc.state.global.voidReason).toBe("Sent twice");
    doc = rejects(doc, voidInvoice({ reason: "x" }), /already void/);
    doc = rejects(doc, removePayment({ id: "p" }), /is void/);
    doc = rejects(doc, att({ id: "b" }), /void invoice/);
    doc = rejects(doc, updateAttachment({ id: "a" }), /void invoice/);
    doc = rejects(doc, removeAttachment({ id: "a" }), /void invoice/);
    rejects(doc, moveAttachment({ id: "a" }), /void invoice/);
  });
});

describe("clearing and keeping", () => {
  it("clears optional fields with null and leaves omitted ones alone", () => {
    let doc = apply(
      utils.createDocument(),
      setHeader({ dueAt: AT, deliveredAt: AT, periodStart: AT, periodEnd: AT, roundingAmount: 0.02 }),
      setHeader({ dueAt: null, deliveredAt: null, periodStart: null, periodEnd: null, roundingAmount: null }),
      setBuyer({ name: "Dai Fonden", contactId: "c", vatId: "dk 40645799", country: "dk" }),
      setBuyer({ contactId: null, vatId: null, country: null }),
      setPaymentInstructions({ bic: "KREDBEBB" }),
      setExchangeRate({ base: "GBP", quote: "EUR", rate: 1.17 }),
      setExchangeRate({ base: "EUR", quote: "USD", rate: 1.1 }),
      setExchangeRate({ base: "EUR", quote: "USD", rate: 1.2 }),
      removeExchangeRate({ base: "USD", quote: "EUR" }),
      line("l", { periodEnd: AT }),
      updateLine({ id: "l", periodEnd: AT }),
      setSeller({ name: "KSDC bv" }),
      addAttachment({ id: "a", role: "OTHER", fileName: "f.pdf", mimeType: "application/pdf", documentId: "d", addedAt: AT }),
      updateAttachment({ id: "a", fileName: "  ", documentId: null }),
    );
    expect(lastError(doc)).toBeUndefined();
    const s = doc.state.global;
    expect([s.dueAt, s.deliveredAt, s.period, s.roundingAmount]).toEqual([null, null, null, null]);
    expect(s.buyer).toMatchObject({ name: "Dai Fonden", contactId: null, vatId: null, country: null });
    expect(s.paymentInstructions.meansCode).toBeNull();
    expect(s.paymentInstructions.bic).toBe("KREDBEBB");
    expect(s.exchangeRates.map((r) => `${r.base}${r.quote}`)).toEqual(["GBPEUR"]);
    expect(s.lines[0].period).toEqual({ start: null, end: AT });
    expect(s.attachments[0]).toMatchObject({ fileName: "f.pdf", documentId: null });

    // Overpaid: removing a payment can leave it paid.
    doc = apply(
      doc,
      issueInvoice({ number: "1", issuedAt: AT }),
      recordPayment({ id: "small", paidAt: AT, amount: 1, method: "CASH", transactionId: null }),
      recordPayment({ id: "big", paidAt: AT, amount: 500, method: "CASH" }),
      removePayment({ id: "small" }),
    );
    expect(doc.state.global.status).toBe("PAID");
    doc = apply(doc, removePayment({ id: "big" }));
    expect(doc.state.global.status).toBe("OPEN");
  });
});
