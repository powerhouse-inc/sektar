/**
 * The search index's rows: one per (document, entity), even when the
 * document names an entity twice.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import { applyAction, rowsFromState } from "./index-rows.js";
import { uniqueEntries } from "./processor.js";

describe("search rows", () => {
  it("keep one row per transaction id, the last one winning", () => {
    const rows = rowsFromState("acc-1", "sektar/bank-account", {
      name: "Current account",
      transactions: [
        { id: "t1", counterparty: "Acme", amount: 10 },
        { id: "t2", counterparty: "Bright", amount: 20 },
        // the same id twice, as a re-import produced it
        { id: "t1", counterparty: "Acme Ltd", amount: 12 },
      ],
    });
    expect(rows).toHaveLength(4);
    const unique = uniqueEntries(rows);
    expect(unique.map((r) => r.entity_id)).toEqual(["doc", "t1", "t2"]);
    expect(unique.find((r) => r.entity_id === "t1")?.title).toBe("Acme Ltd");
    expect(unique.find((r) => r.entity_id === "t1")?.amount).toBe(12);
  });

  it("leave distinct rows alone", () => {
    const rows = rowsFromState("c-1", "sektar/contact", { name: "Ann" });
    expect(uniqueEntries(rows)).toEqual(rows);
  });

  it("carry the currency each amount is in: the document's own, never the books'", () => {
    const [invoice] = rowsFromState("inv-1", "sektar/invoice", {
      number: "2026-001",
      currency: "usd",
      lines: [{ quantity: 1, unitPrice: 100, vatRate: 0 }],
    });
    expect(invoice).toMatchObject({ amount: 100, currency: "USD" });

    const [claim] = rowsFromState("exp-1", "sektar/expense-report", {
      title: "Trip",
      currency: "GBP",
      items: [{ amount: 40 }],
    });
    expect(claim).toMatchObject({ amount: 40, currency: "GBP" });

    // a transaction has no currency of its own: its account's
    const account = rowsFromState("acc-1", "sektar/bank-account", {
      name: "BT Cont curent",
      currency: "RON",
      transactions: [{ id: "t1", counterparty: "Acme", amount: 10 }],
    });
    expect(account.map((r) => r.currency)).toEqual(["RON", "RON"]);

    // nothing to say for a document without one
    const [contact] = rowsFromState("c-1", "sektar/contact", { name: "Ann" });
    expect(contact.currency).toBeNull();
    expect(rowsFromState("inv-2", "sektar/invoice", { lines: [] })[0].currency).toBeNull();
  });

  it("follow the currency through the operations that change it", () => {
    let rows = rowsFromState("acc-1", "sektar/bank-account", {
      name: "BT Cont curent",
      currency: "EUR",
      transactions: [{ id: "t1", counterparty: "Acme", amount: 10 }],
    });
    // lei filed as euros, corrected: the account and every transaction
    rows = applyAction(rows, "acc-1", "sektar/bank-account", "CORRECT_CURRENCY", { currency: "ron" });
    expect(rows.map((r) => r.currency)).toEqual(["RON", "RON"]);
    // a later import is in the account's currency
    rows = applyAction(rows, "acc-1", "sektar/bank-account", "IMPORT_TRANSACTIONS", {
      transactions: [{ id: "t2", counterparty: "Bright", amount: 5 }],
    });
    expect(rows.find((r) => r.entity_id === "t2")?.currency).toBe("RON");
    // a details edit without a currency keeps it; one with a currency sets it everywhere
    rows = applyAction(rows, "acc-1", "sektar/bank-account", "SET_ACCOUNT_DETAILS", { name: "BT" });
    expect(rows.map((r) => r.currency)).toEqual(["RON", "RON", "RON"]);
    rows = applyAction(rows, "acc-1", "sektar/bank-account", "SET_ACCOUNT_DETAILS", { currency: "USD" });
    expect(rows.map((r) => r.currency)).toEqual(["USD", "USD", "USD"]);
    rows = applyAction(rows, "acc-1", "sektar/bank-account", "CORRECT_CURRENCY", {});
    expect(rows.map((r) => r.currency)).toEqual(["USD", "USD", "USD"]);

    let invoice = rowsFromState("inv-1", "sektar/invoice", { currency: "EUR", lines: [] });
    invoice = applyAction(invoice, "inv-1", "sektar/invoice", "SET_CURRENCY", { currency: "chf" });
    expect(invoice[0].currency).toBe("CHF");
    invoice = applyAction(invoice, "inv-1", "sektar/invoice", "SET_CURRENCY", { vatCurrency: "EUR" });
    expect(invoice[0].currency).toBe("CHF");

    let claim = rowsFromState("exp-1", "sektar/expense-report", { currency: "EUR", items: [] });
    claim = applyAction(claim, "exp-1", "sektar/expense-report", "SET_REPORT_DETAILS", { currency: "GBP" });
    expect(claim[0].currency).toBe("GBP");
  });
});
