// One pass of the rate keeper: make a pair for every currency in use that is
// not the books' main currency, and bring each pair's rates up to today.
// Pure over its `KeeperIO`, so the same pass runs in a browser tab's own
// reactor (Sektar on the web, offline) and on the switchboard (the desktop
// app, a deployment) and is tested without either.
//
// It acts on re-read state, never on an operation's payload: a replay cannot
// make a pair twice or record a day twice (RECORD_RATES keeps one rate per
// day). One currency failing (the service does not quote it, the network is
// down) never stops the others: the pass says what failed and the next one
// tries again.
import type {
  CurrencyInUse,
  CurrencyPairRow,
} from "../finance-index/queries.js";
import {
  fetchWindow,
  NoRatesError,
  pairsNeeded,
  RATE_REFRESH_MS,
  type FetchedRate,
} from "./rates.js";

/** What the books say now: read from the finance index. */
export interface BooksFacts {
  bookCurrency: string;
  inUse: readonly CurrencyInUse[];
  pairs: readonly CurrencyPairRow[];
}

export interface KeeperIO {
  /** The instant of the pass, in ms. */
  now(): number;
  facts(): Promise<BooksFacts>;
  /** Makes the pair document and names its currencies; resolves with its id. */
  createPair(base: string, quote: string): Promise<string>;
  fetchRates(
    base: string,
    quote: string,
    window: { from: string; to: string },
  ): Promise<{ source: string; rates: FetchedRate[] }>;
  recordRates(pairId: string, source: string, rates: FetchedRate[]): Promise<void>;
}

/** What the keeper remembers between passes, for as long as it runs. */
export interface KeeperMemory {
  /** Pairs made, by "USD/EUR": the index may not show one yet on the next pass. */
  made: Map<string, { id: string; at: number }>;
  /** When a pair's range may be asked for again, by "USD/EUR". */
  asked: Map<string, { at: number; from: string }>;
  /**
   * The earliest day each pair was fetched from and answered for. A currency
   * the service has no rates for that far back would otherwise be fetched
   * from there again on every pass.
   */
  reached: Map<string, string>;
}

export function newMemory(): KeeperMemory {
  return { made: new Map(), asked: new Map(), reached: new Map() };
}

/** How long a pair this keeper made is trusted to exist before the index shows it. */
export const MADE_TTL_MS = 10 * 60_000;

/** How long before a pair that failed is asked for again. */
export const RETRY_MS = 5 * 60_000;

export interface PassResult {
  /** Pairs made, as "USD/EUR". */
  created: string[];
  /** Pairs that gained rates. */
  updated: string[];
  /**
   * `retry`: worth trying again soon by itself (no network, the service
   * busy). Otherwise the next change of the books or the next sweep tries.
   */
  failed: { pair: string; error: string; retry: boolean }[];
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export async function keepRates(
  io: KeeperIO,
  memory: KeeperMemory,
  options: { force?: boolean } = {},
): Promise<PassResult> {
  const result: PassResult = { created: [], updated: [], failed: [] };
  const now = io.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const { bookCurrency, inUse, pairs } = await io.facts();
  const since = new Map(inUse.map((c) => [c.currency, c.since]));

  const targets = pairs
    .filter((p) => p.quote === bookCurrency)
    .map((p) => ({ id: p.id, base: p.base, firstDay: p.firstDay, lastDay: p.lastDay }));
  // The index shows a pair this keeper made: its memory of it has done its job.
  for (const t of targets) memory.made.delete(`${t.base}/${bookCurrency}`);

  for (const base of pairsNeeded(bookCurrency, inUse, pairs)) {
    const name = `${base}/${bookCurrency}`;
    const known = memory.made.get(name);
    if (known && now - known.at < MADE_TTL_MS) {
      targets.push({ id: known.id, base, firstDay: null, lastDay: null });
      continue;
    }
    try {
      const id = await io.createPair(base, bookCurrency);
      memory.made.set(name, { id, at: now });
      result.created.push(name);
      targets.push({ id, base, firstDay: null, lastDay: null });
    } catch (error) {
      // No right to write here, say: trying every few minutes changes nothing
      result.failed.push({ pair: name, error: messageOf(error), retry: false });
    }
  }

  for (const pair of targets) {
    const name = `${pair.base}/${bookCurrency}`;
    const reached = memory.reached.get(name);
    const window = fetchWindow(
      // already asked that far back: the pair starts where the answer did
      reached && pair.firstDay && reached < pair.firstDay
        ? { ...pair, firstDay: reached }
        : pair,
      since.get(pair.base) ?? null,
      today,
    );
    if (!window) continue;
    const asked = memory.asked.get(name);
    if (!options.force && asked && asked.from === window.from && now < asked.at) {
      continue;
    }
    try {
      const fetched = await io.fetchRates(pair.base, bookCurrency, window);
      const source = fetched.source;
      // Asked for days with no rate yet (a weekend, today before the rates
      // are out), the service answers with the latest day before them: one
      // the pair already holds. Recording it again would write for nothing.
      const rates = fetched.rates.filter((r) => r.date.slice(0, 10) >= window.from);
      // Asked and answered: not again for a while, whatever the answer held
      memory.asked.set(name, { at: now + RATE_REFRESH_MS, from: window.from });
      if (!reached || window.from < reached) memory.reached.set(name, window.from);
      // a range of holidays, or today's rate not published yet
      if (rates.length === 0) continue;
      await io.recordRates(pair.id, source, rates);
      result.updated.push(name);
    } catch (error) {
      // A currency nobody quotes stays unquoted: asked again with the daily
      // refresh. Offline or a busy service: again soon. Never on every change.
      const retry = !(error instanceof NoRatesError);
      memory.asked.set(name, {
        at: now + (retry ? RETRY_MS : RATE_REFRESH_MS),
        from: window.from,
      });
      result.failed.push({ pair: name, error: messageOf(error), retry });
    }
  }
  return result;
}
