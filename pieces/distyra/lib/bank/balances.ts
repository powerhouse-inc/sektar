/**
 * The bank's own balance for an account, and what to do with it.
 *
 * A Sektar bank account adds up the transactions it holds. Those rarely reach
 * back to the day the account was opened (a bank hands over a limited history,
 * and a connection's later pulls only the last 90 days), so the sum alone is
 * short of the real balance. The bank reports the balance itself on the
 * accounts call; recording it sets the account's opening balance so that the
 * account adds up to what the bank says.
 *
 * Reading balances costs one of the connection's four unattended fetches a
 * day, shared with the transaction pulls: `shouldReadBalances` keeps it to
 * what the schedule can afford. Pure, so the rules are tested without a bank.
 */
import type { DistyraAccount } from "../actions/list-accounts.js";

/** How many unattended fetches a bank allows a connection per day. */
export const DAILY_FETCHES = 4;

/**
 * Whether this run reads the balances.
 *
 * - With the person on screen (Sync now) always: such a fetch is their own
 *   and does not count against the daily four.
 * - Unattended, once a day and only when the schedule leaves a fetch for it:
 *   a sync every six hours already uses all four, so its balances are read
 *   on Sync now alone. The run that reads is the first of the UTC day: the
 *   one whose hour is before the interval.
 */
export function shouldReadBalances(run: {
  attended: boolean;
  /** The live interval in hours; 0 when it is not known. */
  everyHours: number;
  /** The hour of the run, UTC (0 to 23). */
  hourUtc: number;
}): boolean {
  if (run.attended) return true;
  if (!(run.everyHours > 0)) return false;
  const pullsPerDay = Math.ceil(24 / run.everyHours);
  if (pullsPerDay + 1 > DAILY_FETCHES) return false;
  return run.hourUtc < run.everyHours;
}

/** A balance worth recording. */
export type BalanceReading = {
  amount: number;
  /** The currency the bank gave for it; null when it gave none. */
  currency: string | null;
  /** ITBD (booked during the day) or CLBD (booked at the last close). */
  kind: string | null;
};

type Booked = { amount?: unknown; currency?: unknown; balance_type?: unknown };

/**
 * The booked balance of one account out of the accounts call's answer, or why
 * there is none. Booked, not available: Sektar counts booked transactions
 * only, so that is the figure its sum can match. The account is found by its
 * stable key first (an `account_id` changes when the holder re-authorizes).
 */
export function pickBalance(
  accounts: unknown,
  wanted: { accountId: string; accountKey?: string | null },
): { reading: BalanceReading } | { skipped: string } {
  const list: DistyraAccount[] = (Array.isArray(accounts) ? (accounts as unknown[]) : []).filter(
    (a): a is DistyraAccount => typeof a === "object" && a !== null,
  );
  const key = wanted.accountKey?.trim();
  const account =
    (key ? list.find((a) => a.account_key === key) : undefined) ??
    list.find((a) => a.account_id === wanted.accountId);
  if (!account) return { skipped: "The bank did not list this account" };
  if (account.balance_known !== true) {
    return { skipped: "The bank returned no balance for this account" };
  }
  const booked = account.balance_booked as Booked | null | undefined;
  if (!booked || typeof booked.amount !== "number" || !Number.isFinite(booked.amount)) {
    return { skipped: "The bank returned no booked balance for this account" };
  }
  const currency =
    typeof booked.currency === "string" && /^[A-Za-z]{3}$/.test(booked.currency.trim())
      ? booked.currency.trim().toUpperCase()
      : null;
  return {
    reading: {
      amount: booked.amount,
      currency,
      kind: typeof booked.balance_type === "string" ? booked.balance_type : null,
    },
  };
}

/** A Sektar bank account's state, as far as recording a balance reads it. */
export type AccountFacts = {
  currency?: string | null;
  openingBalance?: number | null;
  transactions?: { amount: number; status?: string | null }[] | null;
  bankBalance?: { amount: number; readAt: string } | null;
};

const cents = (n: number) => Math.round(n * 100);

/** What the account adds up to now: as the model and the finance index count it. */
export function accountSum(state: AccountFacts): number {
  const counted = (state.transactions ?? [])
    .filter((t) => t.status !== "EXCLUDED" && t.status !== "PENDING")
    .reduce((sum, t) => sum + cents(t.amount), 0);
  return (cents(state.openingBalance ?? 0) + counted) / 100;
}

export type BalancePlan = {
  /** The actions to send, in order; none when the account already agrees. */
  actions: { type: string; input: Record<string, unknown> }[];
  /** What the account added up to before. */
  before: number;
  /** Set when the account was filed under another currency than the bank's. */
  currencyCorrected: { from: string; to: string } | null;
};

/**
 * The actions that bring an account to a reading. The bank's currency wins
 * over the one the account was filed under (a bank that reported none at
 * setup is filed in euros): the currency is corrected first, the amounts
 * untouched. Nothing is sent when the account already adds up to the reading
 * and holds it, so a quiet day writes nothing.
 */
export function planBalance(
  state: AccountFacts,
  reading: BalanceReading,
  readAt: string,
): BalancePlan {
  const before = accountSum(state);
  const filed = (state.currency ?? "").toUpperCase();
  const corrected =
    reading.currency && filed && reading.currency !== filed
      ? { from: filed, to: reading.currency }
      : null;
  const agrees =
    !corrected &&
    cents(before) === cents(reading.amount) &&
    !!state.bankBalance &&
    cents(state.bankBalance.amount) === cents(reading.amount);
  if (agrees) return { actions: [], before, currencyCorrected: null };
  // an older reading than the one held is not sent: the model would refuse it
  if (state.bankBalance && readAt < state.bankBalance.readAt) {
    return { actions: [], before, currencyCorrected: null };
  }
  return {
    actions: [
      ...(corrected
        ? [{ type: "CORRECT_CURRENCY", input: { currency: corrected.to } }]
        : []),
      {
        type: "RECORD_BANK_BALANCE",
        input: {
          amount: reading.amount,
          currency: reading.currency,
          readAt,
          kind: reading.kind,
        },
      },
    ],
    before,
    currencyCorrected: corrected,
  };
}
