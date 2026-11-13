// The books' exchange rates: which currency pairs are missing, which days a
// pair still needs, and reading the rates off the public rate service. Pure
// apart from `fetchRates`; `keeper.ts` decides what to do with them and the
// processor does it.
//
// Rates come from Frankfurter (api.frankfurter.dev): the European Central
// Bank's daily reference rates where the ECB quotes the currency, else
// Frankfurter's blend of central-bank rates. Free, no key, one rate per
// working day; a weekend or holiday uses the latest day before it.
import type {
  CurrencyInUse,
  CurrencyPairRow,
} from "../finance-index/queries.js";

export const RATES_API = "https://api.frankfurter.dev/v2/rates";

/** How long before a pair is asked for again: the rates change once a working day. */
export const RATE_REFRESH_MS = 6 * 3_600_000;

/** How far before the first day in use a pair starts, so that day has a rate before it. */
const LEAD_DAYS = 7;

const DAY_MS = 86_400_000;
const CODE = /^[A-Z]{3}$/;

/** A day as "YYYY-MM-DD", moved by whole days. */
export function shiftDay(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** The currencies in use that have no pair into the main currency yet. */
export function pairsNeeded(
  bookCurrency: string,
  inUse: readonly CurrencyInUse[],
  pairs: readonly CurrencyPairRow[],
): string[] {
  const have = new Set(
    pairs.filter((p) => p.quote === bookCurrency).map((p) => p.base),
  );
  return [
    ...new Set(
      inUse
        .map((c) => c.currency)
        .filter((c) => CODE.test(c) && c !== bookCurrency && !have.has(c)),
    ),
  ].sort();
}

/**
 * The days a pair still needs, as a range to ask for; null when it is up to
 * date. A pair with no rates, or whose first rate is after the first day the
 * books need one for, is fetched from a week before that day (so the day has
 * a rate on or before it: rates skip weekends and holidays); otherwise from
 * the day after its last.
 */
export function fetchWindow(
  pair: Pick<CurrencyPairRow, "firstDay" | "lastDay">,
  since: string | null,
  today: string,
): { from: string; to: string } | null {
  const first = since && since < today ? since : today;
  const reaches =
    pair.firstDay !== null && pair.lastDay !== null && pair.firstDay <= first;
  const from = reaches && pair.lastDay
    ? shiftDay(pair.lastDay, 1)
    : shiftDay(first, -LEAD_DAYS);
  return from > today ? null : { from, to: today };
}

export interface FetchedRate {
  /** Midnight UTC of the day, as the pair document takes it. */
  date: string;
  rate: number;
}

/** The rates of one pair out of the service's answer; anything else is dropped. */
export function parseRates(
  body: unknown,
  base: string,
  quote: string,
): FetchedRate[] {
  if (!Array.isArray(body)) return [];
  const byDay = new Map<string, number>();
  for (const row of body as unknown[]) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (r.base !== base || r.quote !== quote) continue;
    if (typeof r.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue;
    if (typeof r.rate !== "number" || !Number.isFinite(r.rate) || r.rate <= 0) continue;
    byDay.set(r.date, r.rate);
  }
  return [...byDay]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, rate]) => ({ date: `${day}T00:00:00.000Z`, rate }));
}

/**
 * The service answered, and has no rates for the pair (a currency no central
 * bank quotes): asking again soon will not change that. Anything else that
 * goes wrong (no network, the service down or busy) is worth trying again.
 */
export class NoRatesError extends Error {
  override readonly name = "NoRatesError";
}

export function ratesUrl(
  base: string,
  quote: string,
  window: { from: string; to: string },
  provider?: "ecb",
): string {
  const params = new URLSearchParams({
    base,
    quotes: quote,
    from: window.from,
    to: window.to,
  });
  if (provider) params.set("providers", provider);
  return `${RATES_API}?${params.toString()}`;
}

/**
 * A pair's rates over a range: the ECB's where it quotes both currencies,
 * else the service's blend. An empty answer is a real one (a range of
 * holidays); a currency the service does not know rejects with
 * `NoRatesError`, a service that cannot answer now with a plain error.
 */
export async function fetchRates(
  base: string,
  quote: string,
  window: { from: string; to: string },
  fetcher: typeof fetch = fetch,
): Promise<{ source: string; rates: FetchedRate[] }> {
  const ecb = await fetcher(ratesUrl(base, quote, window, "ecb"));
  if (ecb.ok) {
    return { source: "ECB", rates: parseRates(await ecb.json(), base, quote) };
  }
  const blended = await fetcher(ratesUrl(base, quote, window));
  if (!blended.ok) {
    const message = `No exchange rates for ${base} to ${quote} (${String(blended.status)})`;
    // 4xx: the service does not know the pair. 429 and 5xx: it will later.
    throw blended.status >= 400 && blended.status < 500 && blended.status !== 429
      ? new NoRatesError(message)
      : new Error(message);
  }
  return {
    source: "Frankfurter",
    rates: parseRates(await blended.json(), base, quote),
  };
}
