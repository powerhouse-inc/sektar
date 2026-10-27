/**
 * How account lists are ordered: by name, alphabetically (case-insensitive,
 * numbers in numeric order), and what counts as an empty account.
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

/** The accounts that hold money, by name (the dashboard's Accounts card). */
export function accountsWithBalance<T extends Named>(
  accounts: readonly T[],
): T[] {
  return accounts.filter((a) => !isZeroBalance(a)).sort(byName);
}

/** Every account by name, the empty ones last (the account picker). */
export function accountsByName<T extends Named>(accounts: readonly T[]): T[] {
  return [...accounts].sort(
    (a, b) =>
      Number(isZeroBalance(a)) - Number(isZeroBalance(b)) || byName(a, b),
  );
}
