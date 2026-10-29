/**
 * Which pulled rows reach a bank account, and under which reference.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import type { DistyraTransaction } from "../common/types.js";
import { planImport } from "./import-rows.js";

function tx(over: Partial<DistyraTransaction> = {}): DistyraTransaction {
  return {
    account_id: "acc-1",
    id: "ER-1",
    id_source: "entry_reference",
    entry_reference: "ER-1",
    transaction_id: null,
    date: "2026-09-14",
    booking_date: "2026-09-14",
    value_date: null,
    transaction_date: null,
    amount: -12.5,
    currency: "EUR",
    descriptor: "ACME BV",
    counterparty_name: "ACME BV",
    counterparty_iban: null,
    counterparty_bban: null,
    remittance_information: ["invoice 7781"],
    reference_number: null,
    reference_number_scheme: null,
    structured_reference: null,
    credit_debit: "DBIT",
    status: "BOOK",
    pending: false,
    mcc: null,
    bank_code_description: null,
    bank_code_codes: [],
    bank_code_iso_pair: null,
    ...over,
  };
}

let n = 0;
const base = { accountId: "acc-1", knownReferences: new Set<string>(), newId: () => `id-${String(++n)}` };

describe("planning an import", () => {
  it("maps a booked row with a stable reference", () => {
    const plan = planImport([tx()], { ...base, accountKey: "key-A" });
    expect(plan.rows.map(({ id: _id, ...row }) => row)).toEqual([
      {
        bookedAt: "2026-09-14T00:00:00.000Z",
        amount: -12.5,
        counterparty: "ACME BV",
        description: "invoice 7781",
        reference: "distyra:key-A:ER-1",
      },
    ]);
    expect(plan.span).toEqual({ from: "2026-09-14", to: "2026-09-14" });
  });

  it("keeps other accounts, unbooked and undated rows out, and says so", () => {
    const plan = planImport(
      [
        tx({ account_id: "acc-2" }),
        tx({ id: "ER-2", status: "PDNG", pending: true, transaction_id: "TX-2" }),
        tx({ id: "ER-5", status: "CNCL" }),
        tx({ id: "ER-3", date: null }),
        tx({ id: "ER-4" }),
      ],
      base,
    );
    expect(plan.rows.map((r) => r.reference)).toEqual(["distyra:acc-1:ER-4"]);
    expect(plan.counts).toEqual({ received: 5, otherAccount: 1, pending: 1, notBooked: 1, undated: 1, known: 0, toImport: 1 });
  });

  it("plans pending rows apart, under references of their own", () => {
    const pending = (over: Partial<DistyraTransaction>) =>
      tx({ status: "PDNG", pending: true, id_source: "transaction_id", entry_reference: null, ...over });
    const plan = planImport(
      [
        pending({ id: "TX-1", transaction_id: "TX-1" }),
        // reported twice in one pull: once
        pending({ id: "TX-1", transaction_id: "TX-1" }),
        pending({ id: null, transaction_id: null }),
        pending({ id: null, transaction_id: null }),
        pending({ transaction_id: null, date: null }),
      ],
      { ...base, accountKey: "key-A", knownReferences: new Set(["distyra:key-A:p:TX-1"]) },
    );
    // the plan lists every pending entry the bank reports now; the action adds the new ones
    expect(plan.rows).toEqual([]);
    const refs = plan.pending.map((r) => r.reference);
    expect(refs[0]).toBe("distyra:key-A:p:TX-1");
    expect(refs[1]).toMatch(/^distyra:key-A:p:h:[0-9a-f]{16}$/);
    // identical twins without an id stay apart
    expect(refs[2]).toMatch(/^distyra:key-A:p:h:[0-9a-f]{16}$/);
    expect(refs[1]).not.toBe(refs[2]);
    expect(plan.counts).toMatchObject({ pending: 3, undated: 1, toImport: 0 });
    expect(plan.pending[0]).toMatchObject({ amount: -12.5, counterparty: "ACME BV", bookedAt: "2026-09-14T00:00:00.000Z" });
  });

  it("skips what the account already holds and repeats within the batch", () => {
    const plan = planImport([tx(), tx({ id: "ER-2" }), tx({ id: "ER-2" })], {
      ...base,
      knownReferences: new Set(["distyra:acc-1:ER-1"]),
    });
    expect(plan.rows.map((r) => r.reference)).toEqual(["distyra:acc-1:ER-2"]);
    expect(plan.counts.known).toBe(2);
  });

  it("hashes rows without an entry reference, keeping identical twins apart, stably", () => {
    const twin = tx({ id: "T-9", id_source: "transaction_id" });
    const first = planImport([twin, twin], base);
    expect(first.rows).toHaveLength(2);
    const [a, b] = first.rows.map((r) => r.reference);
    expect(a).toMatch(/^distyra:acc-1:h:[0-9a-f]{16}$/);
    expect(a).not.toBe(b);
    // A later pull of the same day lands on the same references.
    const again = planImport([twin, twin], { ...base, knownReferences: new Set([a, b]) });
    expect(again.rows).toHaveLength(0);
  });

  it("falls back on the descriptor, the structured reference and the bank's label", () => {
    const plan = planImport(
      [
        tx({ id: "ER-5", counterparty_name: null, descriptor: "CARD 4421", remittance_information: [], structured_reference: { scheme: "BE", reference: "123", formatted: "+++123/4567/89012+++" } }),
        tx({ id: "ER-6", counterparty_name: "  ", descriptor: "", remittance_information: [], bank_code_description: "Fee" }),
      ],
      base,
    );
    expect(plan.rows.map((r) => [r.counterparty, r.description])).toEqual([
      ["CARD 4421", "+++123/4567/89012+++"],
      ["Unknown", "Fee"],
    ]);
  });

  it("treats anything that is not a list as nothing", () => {
    expect(planImport(undefined, base).rows).toEqual([]);
    expect(planImport({ transactions: [] }, base).counts.received).toBe(0);
  });
});
