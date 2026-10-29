/**
 * The import action against a fake reactor: booked rows posted once, pending
 * rows kept in step with what the bank reports, and nothing written when
 * nothing changed.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import type { DistyraTransaction } from "../common/types.js";
import { distyraImportToBankAccountAction } from "./import-to-bank-account.js";

type Held = { id: string; reference: string | null; status: string };
type Sent = { type: string; input: Record<string, unknown> };

function account(held: Held[]) {
  const sent: Sent[][] = [];
  const reactor = {
    get: () =>
      Promise.resolve({
        header: { documentType: "sektar/bank-account" },
        state: { global: { transactions: held } },
      }),
    execute: (_id: string, _branch: string, actions: Sent[]) => {
      sent.push(actions);
      return Promise.resolve({});
    },
  };
  return { reactor, sent };
}

const tx = (over: Partial<DistyraTransaction>): DistyraTransaction =>
  ({
    account_id: "acc-1",
    id: "ER-1",
    id_source: "entry_reference",
    entry_reference: "ER-1",
    transaction_id: null,
    date: "2026-10-29",
    amount: -9.5,
    descriptor: "Bakery",
    counterparty_name: "Bakery",
    remittance_information: [],
    structured_reference: null,
    status: "BOOK",
    pending: false,
    bank_code_description: null,
    ...over,
  }) as DistyraTransaction;

const pendingTx = (transactionId: string) =>
  tx({ id: transactionId, id_source: "transaction_id", entry_reference: null, transaction_id: transactionId, status: "PDNG", pending: true });

function run(reactor: unknown, transactions: DistyraTransaction[]) {
  return distyraImportToBankAccountAction.run({
    propsValue: { transactions, accountId: "acc-1", accountKey: "key", bankAccountId: "ba-1" },
    reactor,
  } as never) as Promise<{ imported: number; pending: { reported: number; added: number; removed: number } }>;
}

describe("importing into a bank account", () => {
  it("adds new pending rows and drops the ones the bank stopped reporting", async () => {
    const { reactor, sent } = account([
      { id: "b1", reference: "distyra:key:ER-0", status: "NEW" },
      { id: "p-old", reference: "distyra:key:p:TX-OLD", status: "PENDING" },
      { id: "p-kept", reference: "distyra:key:p:TX-KEPT", status: "PENDING" },
    ]);
    const out = await run(reactor, [tx({ id: "ER-1" }), pendingTx("TX-KEPT"), pendingTx("TX-NEW")]);
    expect(out.pending).toEqual({ reported: 2, added: 1, removed: 1 });
    expect(out.imported).toBe(1);
    const [actions] = sent;
    expect(actions.map((a) => a.type)).toEqual(["REMOVE_PENDING_TRANSACTIONS", "IMPORT_TRANSACTIONS"]);
    expect(actions[0].input).toEqual({ ids: ["p-old"] });
    const rows = actions[1].input.transactions as { reference: string; pending?: boolean }[];
    expect(rows.map((r) => [r.reference, r.pending ?? false])).toEqual([
      ["distyra:key:ER-1", false],
      ["distyra:key:p:TX-NEW", true],
    ]);
  });

  it("writes nothing when the bank reports what the account already shows", async () => {
    const { reactor, sent } = account([
      { id: "b1", reference: "distyra:key:ER-1", status: "CATEGORIZED" },
      { id: "p1", reference: "distyra:key:p:TX-1", status: "PENDING" },
    ]);
    const out = await run(reactor, [tx({ id: "ER-1" }), pendingTx("TX-1")]);
    expect(out.pending).toEqual({ reported: 1, added: 0, removed: 0 });
    expect(sent).toEqual([]);
  });
});
