import { describe, expect, it } from "vitest";
import {
  accountSum,
  pickBalance,
  planBalance,
  shouldReadBalances,
} from "./balances.js";

describe("shouldReadBalances", () => {
  it("always reads with the person on screen", () => {
    expect(shouldReadBalances({ attended: true, everyHours: 6, hourUtc: 23 })).toBe(true);
    expect(shouldReadBalances({ attended: true, everyHours: 0, hourUtc: 12 })).toBe(true);
  });

  it("never reads unattended on a schedule that already uses the four daily fetches", () => {
    for (const hourUtc of [0, 5, 6, 12, 18]) {
      expect(shouldReadBalances({ attended: false, everyHours: 6, hourUtc })).toBe(false);
    }
    expect(shouldReadBalances({ attended: false, everyHours: 1, hourUtc: 0 })).toBe(false);
  });

  it("reads once a day when the schedule leaves a fetch: on the first run of the UTC day", () => {
    const runsOf = (everyHours: number, first: number) => {
      const hours: number[] = [];
      for (let h = first; h < 24; h += everyHours) hours.push(h);
      return hours.filter((hourUtc) => shouldReadBalances({ attended: false, everyHours, hourUtc }));
    };
    expect(runsOf(8, 3)).toEqual([3]);
    expect(runsOf(12, 7)).toEqual([7]);
    expect(runsOf(24, 16)).toEqual([16]);
    expect(runsOf(12, 0)).toEqual([0]);
  });

  it("does not read on a schedule it does not know", () => {
    expect(shouldReadBalances({ attended: false, everyHours: 0, hourUtc: 0 })).toBe(false);
    expect(shouldReadBalances({ attended: false, everyHours: Number.NaN, hourUtc: 0 })).toBe(false);
  });
});

const bank = (over: Record<string, unknown> = {}) => ({
  account_id: "acc-1",
  account_key: "ak1_a",
  balance_known: true,
  balance: { amount: 9100, currency: "RON" },
  balance_booked: { amount: 9000, currency: "ron", balance_type: "ITBD" },
  balance_available: { amount: 9100, currency: "RON", balance_type: "ITAV" },
  ...over,
});

describe("pickBalance", () => {
  it("takes the booked balance, not the available one", () => {
    expect(pickBalance([bank()], { accountId: "acc-1" })).toEqual({
      reading: { amount: 9000, currency: "RON", kind: "ITBD" },
    });
  });

  it("finds the account by its stable key first: its id changes on re-authorization", () => {
    const accounts = [bank({ account_id: "new-id" }), bank({ account_id: "acc-1", account_key: "other", balance_booked: { amount: 1, currency: "EUR", balance_type: "CLBD" } })];
    expect(pickBalance(accounts, { accountId: "acc-1", accountKey: " ak1_a " })).toEqual({
      reading: { amount: 9000, currency: "RON", kind: "ITBD" },
    });
    // without a key, or with one the bank does not list: by id
    expect(pickBalance(accounts, { accountId: "acc-1", accountKey: "" })).toEqual({
      reading: { amount: 1, currency: "EUR", kind: "CLBD" },
    });
    expect(pickBalance(accounts, { accountId: "acc-1", accountKey: "gone" })).toEqual({
      reading: { amount: 1, currency: "EUR", kind: "CLBD" },
    });
  });

  it("says why there is no balance to record", () => {
    expect(pickBalance([bank()], { accountId: "other" })).toEqual({ skipped: "The bank did not list this account" });
    expect(pickBalance("not a list", { accountId: "acc-1" })).toEqual({ skipped: "The bank did not list this account" });
    expect(pickBalance([null, "x", bank({ balance_known: false })], { accountId: "acc-1" })).toEqual({
      skipped: "The bank returned no balance for this account",
    });
    // a balance of 0 with balance_known false is not a reading; without a booked one there is nothing either
    for (const balance_booked of [null, undefined, { amount: "9000" }, { amount: Number.NaN }]) {
      expect(pickBalance([bank({ balance_booked })], { accountId: "acc-1" })).toEqual({
        skipped: "The bank returned no booked balance for this account",
      });
    }
  });

  it("keeps a balance whose currency or type the bank did not give", () => {
    expect(pickBalance([bank({ balance_booked: { amount: 0, currency: null } })], { accountId: "acc-1" })).toEqual({
      reading: { amount: 0, currency: null, kind: null },
    });
    expect(pickBalance([bank({ balance_booked: { amount: 5, currency: "lei", balance_type: 7 } })], { accountId: "acc-1" })).toEqual({
      reading: { amount: 5, currency: "LEI", kind: null },
    });
    expect(pickBalance([bank({ balance_booked: { amount: 5, currency: "euro" } })], { accountId: "acc-1" })).toEqual({
      reading: { amount: 5, currency: null, kind: null },
    });
  });
});

const READ_AT = "2026-11-12T10:00:00.000Z";
const account = (over: Record<string, unknown> = {}) => ({
  currency: "RON",
  openingBalance: 0,
  transactions: [
    { amount: 7000.1, status: "NEW" },
    { amount: -1000.2, status: "CATEGORIZED" },
    { amount: -500, status: "PENDING" },
    { amount: -40, status: "EXCLUDED" },
  ],
  bankBalance: null,
  ...over,
});

describe("planBalance", () => {
  it("counts the account as the model does: booked transactions that are not excluded", () => {
    expect(accountSum(account())).toBe(5999.9);
    expect(accountSum({})).toBe(0);
    expect(accountSum({ openingBalance: 10.1, transactions: null })).toBe(10.1);
  });

  it("records the bank's balance on an account that is short of it", () => {
    const plan = planBalance(account(), { amount: 9000, currency: "RON", kind: "ITBD" }, READ_AT);
    expect(plan).toEqual({
      before: 5999.9,
      currencyCorrected: null,
      actions: [{ type: "RECORD_BANK_BALANCE", input: { amount: 9000, currency: "RON", readAt: READ_AT, kind: "ITBD" } }],
    });
  });

  it("corrects the currency first when the bank's is not the one the account was filed under", () => {
    const plan = planBalance(account({ currency: "eur" }), { amount: 9000, currency: "RON", kind: null }, READ_AT);
    expect(plan.currencyCorrected).toEqual({ from: "EUR", to: "RON" });
    expect(plan.actions.map((a) => a.type)).toEqual(["CORRECT_CURRENCY", "RECORD_BANK_BALANCE"]);
    expect(plan.actions[0].input).toEqual({ currency: "RON" });
    // a balance with no currency says nothing about the account's
    const quiet = planBalance(account({ currency: "EUR" }), { amount: 9000, currency: null, kind: null }, READ_AT);
    expect(quiet.currencyCorrected).toBeNull();
    expect(quiet.actions.map((a) => a.type)).toEqual(["RECORD_BANK_BALANCE"]);
  });

  it("writes nothing when the account already adds up to the reading and holds it", () => {
    const agreed = account({ openingBalance: 3000.1, bankBalance: { amount: 9000, readAt: "2026-11-11T10:00:00.000Z" } });
    expect(accountSum(agreed)).toBe(9000);
    expect(planBalance(agreed, { amount: 9000, currency: "RON", kind: "ITBD" }, READ_AT).actions).toEqual([]);
    // the same sum by chance, never read from the bank: recorded
    const chance = account({ openingBalance: 3000.1 });
    expect(planBalance(chance, { amount: 9000, currency: "RON", kind: "ITBD" }, READ_AT).actions).toHaveLength(1);
    // the bank moved: recorded
    expect(planBalance(agreed, { amount: 8700, currency: "RON", kind: "ITBD" }, READ_AT).actions).toHaveLength(1);
  });

  it("does not send a reading older than the one the account holds", () => {
    const later = account({ bankBalance: { amount: 1, readAt: "2026-11-13T10:00:00.000Z" } });
    expect(planBalance(later, { amount: 9000, currency: "RON", kind: null }, READ_AT).actions).toEqual([]);
  });
});
