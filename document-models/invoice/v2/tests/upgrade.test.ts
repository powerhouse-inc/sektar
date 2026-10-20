import type { InvoiceState as V1 } from "document-models/invoice/v1";
import { upgradeGlobal, v2 } from "../../upgrades/v2.js";
import { describe, expect, it } from "vitest";

const v1 = (over: Partial<V1>): V1 => ({
  direction: "OUTGOING",
  number: "INV-2026-0001",
  status: "PAID",
  counterparty: {
    name: "Acme Client BV",
    contactId: "c1",
    email: "ap@acme.example",
    vatId: "NL123",
    address: "Keizersgracht 1, Amsterdam",
  },
  issuedAt: "2026-01-01T00:00:00.000Z",
  dueAt: "2026-01-31T00:00:00.000Z",
  currency: "EUR",
  lines: [
    { id: "a", description: "Design", quantity: 2, unitPrice: 100, vatRate: 21 },
    { id: "b", description: "Export", quantity: 1, unitPrice: 50, vatRate: 0 },
  ],
  payments: [
    { id: "p", paidAt: "2026-01-20T00:00:00.000Z", amount: 292, method: "BANK_TRANSFER", transactionId: "tx" },
  ],
  reference: "PO-1",
  notes: "Thanks",
  voidReason: null,
  ...over,
});

describe("the v1 → v2 upgrade", () => {
  it("makes the counterparty the buyer of an outgoing invoice and keeps everything else", () => {
    const next = upgradeGlobal(v1({}));
    expect(next.buyer).toMatchObject({
      name: "Acme Client BV",
      contactId: "c1",
      email: "ap@acme.example",
      vatId: "NL123",
      street: "Keizersgracht 1, Amsterdam",
      country: null,
    });
    expect(next.seller.name).toBeNull();
    expect(next.lines.map((l) => [l.vatCategory, l.unitCode, l.attachments])).toEqual([
      ["STANDARD", "C62", []],
      ["ZERO_RATED", "C62", []],
    ]);
    expect(next.references.buyerReference).toBe("PO-1");
    expect(next).toMatchObject({
      kind: "INVOICE",
      status: "PAID",
      number: "INV-2026-0001",
      notes: "Thanks",
      vatCurrency: null,
      exchangeRates: [],
      attachments: [],
    });
    expect(next.payments).toEqual(v1({}).payments);
  });

  it("makes the counterparty the seller of an incoming bill; empty fields stay empty", () => {
    const next = upgradeGlobal(
      v1({
        direction: "INCOMING",
        number: null,
        status: "DRAFT",
        counterparty: { name: null, contactId: null, email: null, vatId: null, address: null },
        issuedAt: null,
        dueAt: null,
        payments: [{ id: "p", paidAt: "2026-01-20T00:00:00.000Z", amount: 1, method: "CASH", transactionId: null }],
        reference: null,
        notes: null,
        voidReason: "dup",
      }),
    );
    expect(next.seller.name).toBeNull();
    expect(next.buyer.name).toBeNull();
    expect(next.references.buyerReference).toBeNull();
    expect(next.voidReason).toBe("dup");
    expect(next.payments[0].transactionId).toBeNull();
  });

  it("migrates both the state and the initial state of a document", () => {
    const doc = {
      state: { global: v1({}), local: {} },
      initialState: { global: v1({ lines: [], payments: [] }), local: {} },
    };
    const upgraded = v2.upgradeReducer(doc as never, { type: "UPGRADE_DOCUMENT" } as never) as unknown as {
      state: { global: { buyer: { name: string } } };
      initialState: { global: { lines: unknown[] } };
    };
    expect(upgraded.state.global.buyer.name).toBe("Acme Client BV");
    expect(upgraded.initialState.global.lines).toEqual([]);
    expect(v2.toVersion).toBe(2);
  });
});
