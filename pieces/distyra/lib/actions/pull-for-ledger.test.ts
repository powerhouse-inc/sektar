import { describe, expect, it } from "vitest";
import type { DistyraTransaction } from "../common/types.js";
import { toIdSource, toLedgerRow, toStatus } from "./pull-for-ledger.js";

/** A bank row with everything the API may omit left null, as it sends it. */
function bankRow(
  overrides: Partial<DistyraTransaction> = {},
): DistyraTransaction {
  return {
    account_id: "dd868f70-47b4-44e0-ae0f-4c7c81dbb037",
    id: "ref-1",
    id_source: "entry_reference",
    entry_reference: "ref-1",
    transaction_id: null,
    date: "2026-07-01",
    booking_date: "2026-07-01",
    value_date: "2026-07-02",
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
    bank_code_description: "PMNT",
    bank_code_codes: ["PMNT", "CCRD"],
    bank_code_iso_pair: { family: "CCRD", subFamily: "POSD" },
    ...overrides,
  };
}

describe("toIdSource", () => {
  it("uppercases the bank's lowercase values", () => {
    expect(toIdSource("entry_reference")).toBe("ENTRY_REFERENCE");
    expect(toIdSource("transaction_id")).toBe("TRANSACTION_ID");
  });

  it("drops anything it does not recognise", () => {
    expect(toIdSource(null)).toBeUndefined();
    // An enum value the model does not have would be rejected by validation,
    // so an unknown string must not be passed through.
    expect(toIdSource("something_new")).toBeUndefined();
  });
});

describe("toLedgerRow", () => {
  it("renames every field the ledger spells differently", () => {
    const row = toLedgerRow(bankRow());

    expect(row.externalId).toBe("ref-1");
    expect(row.accountId).toBe("dd868f70-47b4-44e0-ae0f-4c7c81dbb037");
    expect(row.bookingDate).toBe("2026-07-01");
    expect(row.valueDate).toBe("2026-07-02");
    expect(row.counterpartyName).toBe("ACME BV");
    expect(row.bankCodeDescription).toBe("PMNT");
    expect(row.isoCode).toEqual({ family: "CCRD", subFamily: "POSD" });
    expect(row.idSource).toBe("ENTRY_REFERENCE");
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("turns the bank's nulls into absent fields", () => {
    const row = toLedgerRow(bankRow());

    // Present-but-null would fail the ledger's validation on a non-null field,
    // so these must be absent rather than null.
    expect(row).not.toHaveProperty("counterpartyIban", null);
    expect(row.counterpartyIban).toBeUndefined();
    expect(row.counterpartyBban).toBeUndefined();
    expect(row.mcc).toBeUndefined();
    expect(row.structuredReference).toBeUndefined();
  });

  it("keeps an amount of exactly zero", () => {
    expect(toLedgerRow(bankRow({ amount: 0 })).amount).toBe(0);
    expect(toLedgerRow(bankRow({ amount: null })).amount).toBeUndefined();
  });

  it("carries a sub-family-less iso pair through", () => {
    const row = toLedgerRow(
      bankRow({ bank_code_iso_pair: { family: "RCDT", subFamily: null } }),
    );
    expect(row.isoCode).toEqual({ family: "RCDT" });
  });
});

describe("toStatus", () => {
  it("passes every status the ledger knows", () => {
    for (const code of [
      "BOOK",
      "PDNG",
      "CNCL",
      "HOLD",
      "RJCT",
      "SCHD",
      "OTHR",
    ]) {
      expect(toStatus(code)).toBe(code);
    }
  });

  it("drops a status the enum does not have, so the reducer falls back to OTHR", () => {
    expect(toStatus("SOMETHING_NEW")).toBeUndefined();
    expect(toStatus(null)).toBeUndefined();
  });
});
