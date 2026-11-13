/**
 * Record Bank Balance against a fake reactor: the account brought to the
 * bank's figure, its currency corrected when the bank's differs, and nothing
 * written when there is nothing to say.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import { distyraRecordBankBalanceAction } from "./record-bank-balance.js";

type Sent = { type: string; input: Record<string, unknown> };

function reactorWith(global: Record<string, unknown>, documentType = "sektar/bank-account") {
  const sent: Sent[][] = [];
  return {
    sent,
    reactor: {
      get: () => Promise.resolve({ header: { documentType }, state: { global } }),
      execute: (_id: string, _branch: string, actions: Sent[]) => {
        sent.push(actions);
        return Promise.resolve({});
      },
    },
  };
}

const balances = (over: Record<string, unknown> = {}) => ({
  read: true,
  reason: null,
  readAt: "2026-11-12T10:00:00.000Z",
  accounts: [
    {
      account_id: "acc-1",
      account_key: "ak1_a",
      balance_known: true,
      balance_booked: { amount: 9000, currency: "RON", balance_type: "ITBD" },
    },
  ],
  ...over,
});

type Result = {
  bankAccountId: string;
  recorded: boolean;
  reason: string | null;
  balance: number | null;
  before: number | null;
  currencyCorrected: { from: string; to: string } | null;
};

const run = (reactor: unknown, props: Record<string, unknown> = {}) =>
  distyraRecordBankBalanceAction.run({
    propsValue: {
      balances: balances(),
      accountId: "acc-1",
      accountKey: "ak1_a",
      bankAccountId: " doc-1 ",
      ...props,
    },
    reactor,
  } as never) as Promise<Result>;

describe("Record Bank Balance", () => {
  it("brings an account that is short of the bank's balance to it", async () => {
    const { reactor, sent } = reactorWith({
      currency: "RON",
      openingBalance: 0,
      transactions: [{ amount: 6000, status: "NEW" }],
    });
    expect(await run(reactor)).toEqual({
      bankAccountId: "doc-1",
      recorded: true,
      reason: null,
      balance: 9000,
      before: 6000,
      currencyCorrected: null,
    });
    expect(sent).toHaveLength(1);
    expect(sent[0].map((a) => [a.type, a.input])).toEqual([
      ["RECORD_BANK_BALANCE", { amount: 9000, currency: "RON", readAt: "2026-11-12T10:00:00.000Z", kind: "ITBD" }],
    ]);
  });

  it("corrects an account filed in euros when the bank reports lei", async () => {
    const { reactor, sent } = reactorWith({ currency: "EUR", openingBalance: 0, transactions: [] });
    const result = await run(reactor);
    expect(result.currencyCorrected).toEqual({ from: "EUR", to: "RON" });
    expect(sent[0].map((a) => a.type)).toEqual(["CORRECT_CURRENCY", "RECORD_BANK_BALANCE"]);
  });

  it("writes nothing when the balances were not read on this run", async () => {
    const { reactor, sent } = reactorWith({});
    expect(await run(reactor, { balances: { read: false, reason: "Not this run", accounts: [] } })).toMatchObject({
      recorded: false,
      reason: "Not this run",
    });
    expect(await run(reactor, { balances: null })).toMatchObject({
      recorded: false,
      reason: "The balances were not read on this run",
    });
    expect(sent).toEqual([]);
  });

  it("writes nothing for an account the bank gave no balance for", async () => {
    const { reactor, sent } = reactorWith({});
    expect(await run(reactor, { accountId: "other", accountKey: null })).toMatchObject({
      recorded: false,
      reason: "The bank did not list this account",
    });
    expect(sent).toEqual([]);
  });

  it("writes nothing when the account already agrees with the bank", async () => {
    const { reactor, sent } = reactorWith({
      currency: "RON",
      openingBalance: 3000,
      transactions: [{ amount: 6000, status: "NEW" }],
      bankBalance: { amount: 9000, readAt: "2026-11-11T10:00:00.000Z" },
    });
    expect(await run(reactor)).toEqual({
      bankAccountId: "doc-1",
      recorded: false,
      reason: "The account already adds up to the bank's balance",
      balance: 9000,
      before: 9000,
      currencyCorrected: null,
    });
    expect(sent).toEqual([]);
  });

  it("uses now when the reading carries no time, and reads an account with no state as empty", async () => {
    const { sent } = reactorWith({});
    const bare = {
      sent,
      get: () => Promise.resolve({ header: { documentType: "sektar/bank-account" }, state: {} }),
      execute: (_id: string, _branch: string, actions: Sent[]) => {
        sent.push(actions);
        return Promise.resolve({});
      },
    };
    const result = await run(bare, { balances: balances({ readAt: null }) });
    expect(result.recorded).toBe(true);
    expect(typeof sent[0][0].input.readAt).toBe("string");
    expect(Number.isNaN(Date.parse(String(sent[0][0].input.readAt)))).toBe(false);
  });

  it("refuses a document that is not a bank account", async () => {
    const { reactor, sent } = reactorWith({}, "sektar/invoice");
    await expect(run(reactor)).rejects.toThrow("Document doc-1 is a sektar/invoice, not a sektar/bank-account.");
    expect(sent).toEqual([]);
  });
});
