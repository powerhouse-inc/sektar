import { reducer, utils } from "document-models/integration/v1";
import { describe, expect, it } from "vitest";
import {
  createActions,
  defaultChoices,
} from "../../sektar/kit/integrations.js";
import { accountChoice, bankNameOf } from "./BankSetup.js";

const kbc = {
  accountId: "47af97c7",
  accountKey: "ak1_d3b6",
  name: "KBC Business PRO",
  currency: "EUR",
  ibanMasked: "BE** **** **** 2263",
  kind: "CACC",
};

describe("connecting a bank", () => {
  it("names it after the bank, and matches an account to the Sektar one with its IBAN and currency", () => {
    expect(bankNameOf("KBC (BE · business · 123)")).toBe("KBC");
    expect(bankNameOf("Revolut")).toBe("Revolut");
    const sektar = [
      { id: "usd", ibanLast4: "2263", currency: "USD" },
      { id: "eur", ibanLast4: "2263", currency: "eur" },
    ];
    expect(accountChoice(kbc, sektar)).toMatchObject({
      label: "KBC Business PRO · EUR · BE** **** **** 2263",
      bankAccountId: "eur",
      name: "KBC Business PRO EUR",
      kind: "CURRENT",
    });
    // No match: a new one, of the kind the bank says
    expect(
      accountChoice({ ...kbc, ibanMasked: "BE** 9999", kind: "SVGS" }, sektar),
    ).toMatchObject({ bankAccountId: null, kind: "SAVINGS" });
    expect(
      accountChoice({ ...kbc, ibanMasked: null, kind: "CARD" }, sektar),
    ).toMatchObject({ bankAccountId: null, kind: "CREDIT_CARD" });
  });

  it("writes the connection, the bank and its accounts, every 6 hours, without a backfill", () => {
    const now = new Date(2026, 9, 28);
    const choices = {
      ...defaultChoices("TRANSACTIONS", "distyra", now),
      name: "KBC",
      connectionId: "distyra-key",
      bankConnectionId: "5f3665c9",
      bankName: "KBC",
      accounts: [{ ...accountChoice(kbc, []), bankAccountId: "bank-1" }],
    };
    expect(choices.every).toEqual({ value: 6, unit: "HOURS" });
    const doc = createActions(choices, now, () => "x").reduce(
      (d, a) => reducer(d, a),
      utils.createDocument(),
    );
    expect(doc.operations.global.every((op) => !op.error)).toBe(true);
    const s = doc.state.global;
    expect(s.intent.connectionId).toBe("distyra-key");
    expect(s.intent.source).toEqual({
      bankConnectionId: "5f3665c9",
      accounts: [
        {
          accountId: "47af97c7",
          accountKey: "ak1_d3b6",
          bankAccountId: "bank-1",
          label: "KBC Business PRO · EUR · BE** **** **** 2263",
        },
      ],
    });
    expect(s.intent.backfill).toMatchObject({ enabled: false, items: [] });
  });
});
