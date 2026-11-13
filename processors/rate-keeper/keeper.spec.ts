import { describe, expect, it } from "vitest";
import {
  keepRates,
  MADE_TTL_MS,
  newMemory,
  RETRY_MS,
  type BooksFacts,
  type KeeperIO,
} from "./keeper.js";
import { NoRatesError, RATE_REFRESH_MS } from "./rates.js";

const NOW = Date.parse("2026-11-12T10:00:00.000Z");

const pairRow = (base: string, quote: string, firstDay: string | null, lastDay: string | null) => ({
  id: `pair-${base}-${quote}`,
  base,
  quote,
  rateCount: lastDay ? 1 : 0,
  firstDay,
  lastDay,
  lastRate: lastDay ? 0.2 : null,
  lastSource: lastDay ? "ECB" : null,
  lastFetchedAt: null,
});

/** Books and a rate service that record what the keeper did to them. */
function world(facts: BooksFacts, options: { failFetch?: Set<string>; failCreate?: Set<string>; empty?: boolean } = {}) {
  const log: string[] = [];
  let now = NOW;
  const io: KeeperIO = {
    now: () => now,
    facts: () => Promise.resolve(facts),
    createPair: (base, quote) => {
      if (options.failCreate?.has(base)) return Promise.reject(new Error("read only"));
      log.push(`create ${base}/${quote}`);
      return Promise.resolve(`new-${base}-${quote}`);
    },
    fetchRates: (base, quote, window) => {
      if (options.failFetch?.has(base)) return Promise.reject(new Error("offline"));
      log.push(`fetch ${base}/${quote} ${window.from}..${window.to}`);
      return Promise.resolve({
        source: "ECB",
        rates: options.empty ? [] : [{ date: `${window.to}T00:00:00.000Z`, rate: 0.2 }],
      });
    },
    recordRates: (pairId, source, rates) => {
      log.push(`record ${pairId} ${source} ${String(rates.length)}`);
      return Promise.resolve();
    },
  };
  return { io, log, at: (ms: number) => (now = ms) };
}

const books = (over: Partial<BooksFacts> = {}): BooksFacts => ({
  bookCurrency: "EUR",
  inUse: [
    { currency: "EUR", since: "2026-01-05" },
    { currency: "RON", since: "2026-10-01" },
  ],
  pairs: [],
  ...over,
});

describe("keepRates", () => {
  it("makes the missing pair and fetches it from a week before its first day", async () => {
    const w = world(books());
    const result = await keepRates(w.io, newMemory());
    expect(w.log).toEqual([
      "create RON/EUR",
      "fetch RON/EUR 2026-09-24..2026-11-12",
      "record new-RON-EUR ECB 1",
    ]);
    expect(result).toEqual({ created: ["RON/EUR"], updated: ["RON/EUR"], failed: [] });
  });

  it("does nothing for books in one currency", async () => {
    const w = world(books({ inUse: [{ currency: "EUR", since: "2026-01-05" }] }));
    expect(await keepRates(w.io, newMemory())).toEqual({ created: [], updated: [], failed: [] });
    expect(w.log).toEqual([]);
  });

  it("never makes a pair twice while the index has not shown it yet", async () => {
    const w = world(books());
    const memory = newMemory();
    await keepRates(w.io, memory);
    w.log.length = 0;
    // the same facts again: the index lags behind the write
    await keepRates(w.io, memory);
    expect(w.log).toEqual([]);
  });

  it("asks an up-to-date service again only once the refresh is due", async () => {
    const w = world(books({ pairs: [pairRow("RON", "EUR", "2026-09-24", "2026-11-11")] }), { empty: true });
    const memory = newMemory();
    await keepRates(w.io, memory);
    w.at(NOW + RATE_REFRESH_MS - 1);
    await keepRates(w.io, memory);
    expect(w.log).toHaveLength(1);
    w.at(NOW + RATE_REFRESH_MS);
    await keepRates(w.io, memory);
    expect(w.log).toHaveLength(2);
  });

  it("makes the pair again when it never showed up", async () => {
    const w = world(books());
    const memory = newMemory();
    await keepRates(w.io, memory);
    w.log.length = 0;
    w.at(NOW + MADE_TTL_MS);
    await keepRates(w.io, memory);
    expect(w.log[0]).toBe("create RON/EUR");
  });

  it("continues an existing pair from the day after its last rate, and forgets it made it", async () => {
    const memory = newMemory();
    memory.made.set("RON/EUR", { id: "stale", at: NOW });
    const w = world(books({ pairs: [pairRow("RON", "EUR", "2026-09-24", "2026-11-10")] }));
    const result = await keepRates(w.io, memory);
    expect(w.log).toEqual(["fetch RON/EUR 2026-11-11..2026-11-12", "record pair-RON-EUR ECB 1"]);
    expect(result.created).toEqual([]);
    expect(memory.made.size).toBe(0);
  });

  it("leaves a pair alone once it holds today's rate", async () => {
    const w = world(books({ pairs: [pairRow("RON", "EUR", "2026-09-24", "2026-11-12")] }));
    await keepRates(w.io, newMemory());
    expect(w.log).toEqual([]);
  });

  it("records nothing for an empty answer, and does not ask again at once", async () => {
    const w = world(books({ pairs: [pairRow("RON", "EUR", "2026-09-24", "2026-11-11")] }), { empty: true });
    const memory = newMemory();
    const result = await keepRates(w.io, memory);
    expect(w.log).toEqual(["fetch RON/EUR 2026-11-12..2026-11-12"]);
    expect(result.updated).toEqual([]);
    await keepRates(w.io, memory);
    expect(w.log).toHaveLength(1);
    // unless asked to
    await keepRates(w.io, memory, { force: true });
    expect(w.log).toHaveLength(2);
  });

  it("does not record again a day the pair already holds", async () => {
    const w = world(books({ pairs: [pairRow("RON", "EUR", "2026-09-24", "2026-11-11")] }));
    // today's rate is not out: the service answers with yesterday's
    w.io.fetchRates = () =>
      Promise.resolve({ source: "ECB", rates: [{ date: "2026-11-11T00:00:00.000Z", rate: 0.187 }] });
    const result = await keepRates(w.io, newMemory());
    expect(w.log).toEqual([]);
    expect(result).toEqual({ created: [], updated: [], failed: [] });
  });

  it("goes back once for a pair the service has no older rates for", async () => {
    // the books need a rate from 1 Oct; the pair's first rate is from 20 Oct
    const w = world(books({ pairs: [pairRow("RON", "EUR", "2026-10-20", "2026-11-12")] }), { empty: true });
    const memory = newMemory();
    await keepRates(w.io, memory);
    expect(w.log).toEqual(["fetch RON/EUR 2026-09-24..2026-11-12"]);
    // asked that far back and answered: not again, even when the refresh is due
    w.at(NOW + RATE_REFRESH_MS);
    await keepRates(w.io, memory);
    expect(w.log).toHaveLength(1);
  });

  it("only keeps the pairs that point at the main currency", async () => {
    const w = world(
      books({
        bookCurrency: "USD",
        inUse: [
          { currency: "EUR", since: null },
          { currency: "USD", since: null },
        ],
        pairs: [pairRow("USD", "EUR", "2026-09-24", "2026-11-01")],
      }),
    );
    await keepRates(w.io, newMemory());
    // the old USD->EUR pair is history: EUR->USD is the one the books need now
    expect(w.log).toEqual([
      "create EUR/USD",
      "fetch EUR/USD 2026-11-05..2026-11-12",
      "record new-EUR-USD ECB 1",
    ]);
  });

  it("carries on past a currency that fails, and tries it again later", async () => {
    const facts = books({
      inUse: [
        { currency: "RON", since: "2026-10-01" },
        { currency: "XXX", since: null },
        { currency: "ZZZ", since: null },
      ],
    });
    const w = world(facts, { failFetch: new Set(["XXX"]), failCreate: new Set(["ZZZ"]) });
    const memory = newMemory();
    const result = await keepRates(w.io, memory);
    expect(result.updated).toEqual(["RON/EUR"]);
    expect(result.failed).toEqual([
      { pair: "ZZZ/EUR", error: "read only", retry: false },
      { pair: "XXX/EUR", error: "offline", retry: true },
    ]);
    // the failed fetch is not hammered on every change
    w.log.length = 0;
    const again = await keepRates(w.io, memory);
    expect(again.failed).toEqual([{ pair: "ZZZ/EUR", error: "read only", retry: false }]);
    w.at(NOW + RETRY_MS);
    const later = await keepRates(w.io, memory);
    expect(later.failed.map((f) => f.pair)).toEqual(["ZZZ/EUR", "XXX/EUR"]);
  });

  it("says what failed when the error is not an Error", async () => {
    const w = world(books());
    // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- what a host may throw
    w.io.createPair = () => Promise.reject("no drive");
    expect((await keepRates(w.io, newMemory())).failed).toEqual([{ pair: "RON/EUR", error: "no drive", retry: false }]);
  });

  it("asks for a currency nobody quotes only with the daily refresh", async () => {
    const w = world(books());
    w.io.fetchRates = (base, quote) => {
      w.log.push(`fetch ${base}/${quote}`);
      return Promise.reject(new NoRatesError("No exchange rates for RON to EUR (422)"));
    };
    const memory = newMemory();
    const result = await keepRates(w.io, memory);
    expect(result.failed).toEqual([
      { pair: "RON/EUR", error: "No exchange rates for RON to EUR (422)", retry: false },
    ]);
    w.at(NOW + RETRY_MS);
    await keepRates(w.io, memory);
    expect(w.log.filter((l) => l.startsWith("fetch"))).toHaveLength(1);
    w.at(NOW + RATE_REFRESH_MS);
    await keepRates(w.io, memory);
    expect(w.log.filter((l) => l.startsWith("fetch"))).toHaveLength(2);
  });
});
