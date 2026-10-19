import {
  addLine,
  issueInvoice,
  recordPayment,
  reducer,
  removeLine,
  setInvoiceDetails,
  updateLine,
  utils,
  voidInvoice,
  type InvoiceDocument,
} from "document-models/invoice/v1";
import { describe, expect, it } from "vitest";

const T0 = "2026-09-01T10:00:00.000Z";
const T1 = "2026-10-01T10:00:00.000Z";
const T2 = "2026-09-20T10:00:00.000Z";

function draft(): InvoiceDocument {
  let doc = reducer(
    utils.createDocument(),
    setInvoiceDetails({
      direction: "OUTGOING",
      counterpartyName: "Bright Media Ltd",
      contactId: "c1",
      email: "accounts@brightmedia.co.uk",
      currency: "GBP",
      reference: "PO-77",
      notes: "Thanks!",
    }),
  );
  doc = reducer(
    doc,
    addLine({
      id: "l1",
      description: "Brand identity",
      quantity: 1,
      unitPrice: 9800,
      vatRate: 20,
    }),
  );
  doc = reducer(
    doc,
    addLine({
      id: "l2",
      description: "Retainer",
      quantity: 2,
      unitPrice: 3200,
      vatRate: 0,
    }),
  );
  return doc;
}

const lastError = (doc: InvoiceDocument) => doc.operations.global.at(-1)?.error;

describe("invoice lifecycle", () => {
  it("drafts, edits lines, issues, takes two payments and settles", () => {
    let doc = draft();
    let s = doc.state.global;
    expect(s.status).toBe("DRAFT");
    expect(s.counterparty).toEqual({
      name: "Bright Media Ltd",
      contactId: "c1",
      email: "accounts@brightmedia.co.uk",
      vatId: null,
      address: null,
    });
    expect(s.currency).toBe("GBP");

    doc = reducer(
      doc,
      updateLine({ id: "l2", quantity: 3, description: "Retainer x3" }),
    );
    doc = reducer(doc, updateLine({ id: "l2", unitPrice: 3000, vatRate: 20 }));
    doc = reducer(doc, removeLine({ id: "l1" }));
    s = doc.state.global;
    expect(s.lines).toEqual([
      {
        id: "l2",
        description: "Retainer x3",
        quantity: 3,
        unitPrice: 3000,
        vatRate: 20,
      },
    ]);

    doc = reducer(
      doc,
      issueInvoice({ number: "INV-2026-0001", issuedAt: T0, dueAt: T1 }),
    );
    s = doc.state.global;
    expect(s.status).toBe("OPEN");
    expect(s.number).toBe("INV-2026-0001");
    expect(s.issuedAt).toBe(T0);

    // 3 × 3000 × 1.2 = 10800
    doc = reducer(
      doc,
      recordPayment({
        id: "p1",
        paidAt: T2,
        amount: 5000,
        method: "BANK_TRANSFER",
        transactionId: "tx1",
      }),
    );
    expect(doc.state.global.status).toBe("OPEN");
    doc = reducer(
      doc,
      recordPayment({ id: "p2", paidAt: T1, amount: 5800, method: "CARD" }),
    );
    s = doc.state.global;
    expect(s.status).toBe("PAID");
    expect(s.payments.map((p) => [p.amount, p.transactionId])).toEqual([
      [5000, "tx1"],
      [5800, null],
    ]);
    expect(doc.operations.global.every((o) => !o.error)).toBe(true);
  });

  it("locks details after issuing and refuses changes when closed", () => {
    let doc = draft();
    doc = reducer(
      doc,
      issueInvoice({ number: "INV-1", issuedAt: T0, dueAt: T1 }),
    );
    doc = reducer(doc, setInvoiceDetails({ direction: "INCOMING" }));
    expect(lastError(doc)).toBe(
      "The direction is fixed once the invoice is issued",
    );
    doc = reducer(doc, setInvoiceDetails({ currency: "EUR" }));
    expect(lastError(doc)).toBe(
      "The currency is fixed once the invoice is issued",
    );
    doc = reducer(doc, setInvoiceDetails({ notes: "Updated note", dueAt: T2 }));
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global.notes).toBe("Updated note");
    expect(doc.state.global.dueAt).toBe(T2);
    doc = reducer(
      doc,
      addLine({
        id: "l3",
        description: "Late",
        quantity: 1,
        unitPrice: 1,
        vatRate: 0,
      }),
    );
    expect(lastError(doc)).toBe("Lines can only change on a draft");
    doc = reducer(doc, updateLine({ id: "l1", quantity: 2 }));
    expect(lastError(doc)).toBe("Lines can only change on a draft");
    doc = reducer(doc, removeLine({ id: "l1" }));
    expect(lastError(doc)).toBe("Lines can only change on a draft");
    doc = reducer(
      doc,
      issueInvoice({ number: "INV-2", issuedAt: T0, dueAt: T1 }),
    );
    expect(lastError(doc)).toBe("Only a draft can be issued");

    doc = reducer(doc, voidInvoice({ reason: "Wrong client" }));
    expect(doc.state.global.status).toBe("VOID");
    expect(doc.state.global.voidReason).toBe("Wrong client");
    doc = reducer(doc, voidInvoice({ reason: "again" }));
    expect(lastError(doc)).toBe("The invoice is already void");
    doc = reducer(doc, setInvoiceDetails({ notes: "x" }));
    expect(lastError(doc)).toBe("A paid or void invoice cannot change");
    doc = reducer(
      doc,
      recordPayment({ id: "p9", paidAt: T1, amount: 1, method: "CASH" }),
    );
    expect(lastError(doc)).toBe("Payments apply to open invoices only");
  });

  it("sets every header field on a draft", () => {
    let doc = reducer(
      utils.createDocument(),
      setInvoiceDetails({
        number: "N-1",
        vatId: "GB 1",
        address: "14 Old Street",
        reference: "PO-1",
        email: "a@b.c",
        counterpartyName: null,
      }),
    );
    expect(doc.state.global).toMatchObject({
      number: "N-1",
      reference: "PO-1",
      counterparty: {
        vatId: "GB 1",
        address: "14 Old Street",
        email: "a@b.c",
        name: null,
      },
    });
    doc = reducer(
      doc,
      setInvoiceDetails({
        direction: "INCOMING",
        currency: "USD",
        contactId: "c9",
      }),
    );
    expect(doc.state.global).toMatchObject({
      direction: "INCOMING",
      currency: "USD",
      counterparty: { contactId: "c9" },
    });
    doc = reducer(
      doc,
      setInvoiceDetails({
        direction: null,
        currency: null,
        number: null,
        notes: null,
      }),
    );
    expect(doc.state.global).toMatchObject({
      direction: "INCOMING",
      currency: "USD",
      number: null,
      notes: null,
    });
  });

  it("validates lines, payments and empty issues", () => {
    let doc = reducer(
      utils.createDocument(),
      issueInvoice({ number: "INV-0", issuedAt: T0, dueAt: T1 }),
    );
    expect(lastError(doc)).toBe("An invoice needs at least one line");
    doc = reducer(
      doc,
      addLine({
        id: "bad",
        description: "Zero",
        quantity: 0,
        unitPrice: 10,
        vatRate: 0,
      }),
    );
    expect(lastError(doc)).toBe("Quantity must be positive");
    doc = reducer(doc, updateLine({ id: "missing", quantity: 1 }));
    expect(lastError(doc)).toBe("Line missing not found");
    doc = reducer(doc, removeLine({ id: "missing" }));
    expect(lastError(doc)).toBe("Line missing not found");
    doc = reducer(
      doc,
      addLine({
        id: "ok",
        description: "One",
        quantity: 1,
        unitPrice: 100,
        vatRate: 21,
      }),
    );
    doc = reducer(doc, updateLine({ id: "ok", quantity: -1 }));
    expect(lastError(doc)).toBe("Quantity must be positive");
    doc = reducer(
      doc,
      issueInvoice({ number: "INV-0", issuedAt: T0, dueAt: T1 }),
    );
    doc = reducer(
      doc,
      recordPayment({ id: "p0", paidAt: T1, amount: 0, method: "OTHER" }),
    );
    expect(lastError(doc)).toBe("A payment must be positive");
    doc = reducer(
      doc,
      recordPayment({ id: "p1", paidAt: T1, amount: 121, method: "OTHER" }),
    );
    expect(doc.state.global.status).toBe("PAID");
    doc = reducer(doc, voidInvoice({ reason: "too late" }));
    expect(lastError(doc)).toBe("A paid invoice cannot be voided");
  });
});
