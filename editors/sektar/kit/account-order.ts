/**
 * How account lists are ordered: by name, alphabetically (case-insensitive,
 * numbers in numeric order), or the most recently used first; and what counts
 * as an empty account.
 */

type Named = { name: string | null; balance: number };

/** A balance that rounds to zero cents is an empty account. */
export function isZeroBalance(account: Pick<Named, "balance">): boolean {
  return Math.round(account.balance * 100) === 0;
}

/** By name; an account without one after the named ones. */
function byName(a: Named, b: Named): number {
  if (!a.name || !b.name) return Number(!a.name) - Number(!b.name);
  return a.name.localeCompare(b.name, undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

/** How many accounts the dashboard's Accounts card shows. */
export const RECENT_ACCOUNTS = 6;

/**
 * The accounts that hold money, the most recently used first: by the date of
 * their latest transaction, an account without any last, then by name; at
 * most `max` (the dashboard's Accounts card).
 */
export function recentAccountsWithBalance<
  T extends Named & { lastBookedAt: string | null },
>(accounts: readonly T[], max = RECENT_ACCOUNTS): T[] {
  return accounts
    .filter((a) => !isZeroBalance(a))
    .sort((a, b) => {
      if (a.lastBookedAt !== b.lastBookedAt) {
        if (!a.lastBookedAt) return 1;
        if (!b.lastBookedAt) return -1;
        return b.lastBookedAt.localeCompare(a.lastBookedAt);
      }
      return byName(a, b);
    })
    .slice(0, max);
}

/** Every account by name, the empty ones last (the account picker). */
export function accountsByName<T extends Named>(accounts: readonly T[]): T[] {
  return [...accounts].sort(
    (a, b) =>
      Number(isZeroBalance(a)) - Number(isZeroBalance(b)) || byName(a, b),
  );
}
