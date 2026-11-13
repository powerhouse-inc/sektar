/**
 * Record Bank Balance — the step after Read Balances: bring one Sektar bank
 * account to the balance the bank reports for it, so the account adds up to
 * the bank's figure whatever history was imported (see balances.ts).
 */
import { createAction, Property } from "@powerhousedao/pieces-framework";
import { toGlobalAction } from "../osc/client.js";
import { pickBalance, planBalance, type AccountFacts } from "./balances.js";
import { BANK_ACCOUNT_TYPE } from "./import-to-bank-account.js";

type Balances = { read?: unknown; reason?: unknown; readAt?: unknown; accounts?: unknown };

export const distyraRecordBankBalanceAction = createAction({
  // Saved workflows refer to the action by name: don't rename it once published
  name: "record-bank-balance",
  // Reaches the reactor, not Distyra: the balance was read by the step before.
  requireAuth: false,
  requireReactor: "write",
  displayName: "Record Bank Balance",
  description:
    "Bring a Sektar bank account to the booked balance the bank reports for it: the account's opening balance is set so that it adds up to the bank's figure. When the bank reports the balance in another currency than the account was filed under, the account's currency is corrected first. Nothing is written when the account already agrees, or when the balances were not read on this run.",
  props: {
    balances: Property.Json({
      displayName: "Balances",
      description: "The Read Balances step's output, e.g. {{steps.balances.output}}.",
      required: true,
    }),
    accountId: Property.ShortText({
      displayName: "Distyra account ID",
      description: "The account_id of the bank's account.",
      required: true,
    }),
    accountKey: Property.ShortText({
      displayName: "Distyra account key",
      description:
        "The stable account_key: the account is found by it first, so a re-authorization does not lose it.",
      required: false,
    }),
    bankAccountId: Property.ShortText({
      displayName: "Bank account document",
      description: "The sektar/bank-account document to bring to the balance.",
      required: true,
    }),
  },
  async run(context) {
    const p = context.propsValue;
    const bankAccountId = p.bankAccountId.trim();
    const balances = (p.balances ?? {}) as Balances;
    const skipped = (reason: string) => ({
      bankAccountId,
      recorded: false,
      reason,
      balance: null,
      before: null,
      currencyCorrected: null,
    });
    if (balances.read !== true) {
      return skipped(
        typeof balances.reason === "string" ? balances.reason : "The balances were not read on this run",
      );
    }
    const picked = pickBalance(balances.accounts, {
      accountId: p.accountId.trim(),
      accountKey: p.accountKey,
    });
    if ("skipped" in picked) return skipped(picked.skipped);
    const doc = await context.reactor.get(bankAccountId);
    if (doc.header.documentType !== BANK_ACCOUNT_TYPE) {
      throw new Error(
        `Document ${bankAccountId} is a ${doc.header.documentType}, not a ${BANK_ACCOUNT_TYPE}.`,
      );
    }
    const state = (doc.state as { global?: AccountFacts }).global ?? {};
    const readAt =
      typeof balances.readAt === "string" && balances.readAt ? balances.readAt : new Date().toISOString();
    const plan = planBalance(state, picked.reading, readAt);
    if (plan.actions.length === 0) {
      return { ...skipped("The account already adds up to the bank's balance"), balance: picked.reading.amount, before: plan.before };
    }
    await context.reactor.execute(bankAccountId, "main", plan.actions.map(toGlobalAction));
    return {
      bankAccountId,
      recorded: true,
      reason: null,
      balance: picked.reading.amount,
      before: plan.before,
      currencyCorrected: plan.currencyCorrected,
    };
  },
});
