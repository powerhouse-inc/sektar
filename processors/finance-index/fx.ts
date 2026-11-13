// Converting amounts into the main currency of the books. Pure: shared by the
// index's queries (the switchboard and a tab's own reactor) and their tests.
//
// One rule, so an amount is never converted twice: every amount is stored in
// its own currency and converted once, here, when a total is read. Only the
// pairs that point at the main currency are used, one hop: no inverse and no
// chain through a third currency.

/** The currency of books that have no settings document yet. */
export const DEFAULT_BOOK_CURRENCY = "EUR";

/** One day's rate of a pair quoted in the main currency. */
export interface FxRate {
  /** The currency converted from. */
  base: string;
  /** "YYYY-MM-DD" */
  day: string;
  /** How many of the main currency one `base` is worth. */
  rate: number;
}

/** A rate an invoice carries itself (1 base = rate quote). */
export interface OwnRate {
  base: string;
  quote: string;
  rate: number;
}

/** The day of an instant or a day, as "YYYY-MM-DD"; null when there is none. */
export function dayOf(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

/**
 * The rates of the books, and which currencies a total could not convert.
 * A total leaves such amounts out and names their currencies: adding them as
 * if they were the main currency is what this replaces.
 */
export class Fx {
  /** Per currency: its days in ascending order, and their rates. */
  private readonly table = new Map<string, { days: string[]; rates: number[] }>();
  /** The currencies asked for that have no rate at all. */
  readonly missing = new Set<string>();

  constructor(
    readonly bookCurrency: string,
    rates: readonly FxRate[],
  ) {
    const sorted = [...rates]
      .filter((r) => r.base !== bookCurrency && r.rate > 0)
      .sort((a, b) => a.day.localeCompare(b.day));
    for (const r of sorted) {
      let entry = this.table.get(r.base);
      if (!entry) {
        entry = { days: [], rates: [] };
        this.table.set(r.base, entry);
      }
      // one rate per day: the first wins (the caller orders pairs)
      if (entry.days.at(-1) === r.day) continue;
      entry.days.push(r.day);
      entry.rates.push(r.rate);
    }
  }

  /**
   * How many of the main currency one `currency` is worth on `day`: the
   * latest rate on or before it (weekends and holidays have none of their
   * own), else the earliest after it. Without a day, the latest rate. Null
   * when the pair holds no rate, and the currency is noted as missing.
   */
  rate(currency: string, day?: string | null): number | null {
    if (currency === this.bookCurrency) return 1;
    const entry = this.table.get(currency);
    if (!entry || entry.days.length === 0) {
      this.missing.add(currency);
      return null;
    }
    const wanted = dayOf(day);
    if (!wanted) return entry.rates[entry.rates.length - 1];
    // the last day <= wanted, by binary search
    let lo = 0;
    let hi = entry.days.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (entry.days[mid] <= wanted) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return entry.rates[found === -1 ? 0 : found];
  }

  /** `amount` of `currency` in the main currency; null when no rate is known. */
  convert(amount: number, currency: string, day?: string | null): number | null {
    const rate = this.rate(currency, day);
    return rate === null ? null : amount * rate;
  }

  /**
   * An invoice's amount in the main currency: at the invoice's own rate when
   * it carries one (fixed when it was issued), else at the latest rate of
   * the books. Null when neither is known.
   */
  convertInvoice(amount: number, currency: string, own: readonly OwnRate[]): number | null {
    if (currency === this.bookCurrency) return amount;
    const direct = own.find((r) => r.base === currency && r.quote === this.bookCurrency);
    if (direct && direct.rate > 0) return amount * direct.rate;
    const inverse = own.find((r) => r.base === this.bookCurrency && r.quote === currency);
    if (inverse && inverse.rate > 0) return amount / inverse.rate;
    return this.convert(amount, currency);
  }

  /** The currencies left out of a total, in alphabetical order. */
  unconverted(): string[] {
    return [...this.missing].sort();
  }
}

/** An invoice row's own rates out of its JSON column; none when it is not a list. */
export function parseOwnRates(json: string | null | undefined): OwnRate[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is OwnRate =>
        !!r &&
        typeof r === "object" &&
        typeof (r as OwnRate).base === "string" &&
        typeof (r as OwnRate).quote === "string" &&
        typeof (r as OwnRate).rate === "number",
    );
  } catch {
    return [];
  }
}

/** Two decimals: what a total of converted amounts is rounded to. */
export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}
