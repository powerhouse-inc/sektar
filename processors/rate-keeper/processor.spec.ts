/**
 * The rate keeper as a processor: when it runs a pass, that it writes through
 * the host's dispatch, and that it stops. The pass itself is keeper.spec.ts.
 */
import type { OperationWithContext } from "@powerhousedao/reactor-browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FinanceQueryBuilder } from "../finance-index/queries.js";

const books = vi.hoisted(() => ({
  bookCurrency: "EUR",
  inUse: [{ currency: "RON", since: "2026-10-01" }] as { currency: string; since: string | null }[],
  pairs: [] as unknown[],
  fail: false,
}));

vi.mock("../finance-index/queries.js", () => ({
  loadSettings: () =>
    books.fail
      ? Promise.reject(new Error("no such table"))
      : Promise.resolve({ documentId: null, bookCurrency: books.bookCurrency }),
  loadCurrenciesInUse: () => Promise.resolve(books.inUse),
  loadPairs: () => Promise.resolve(books.pairs),
}));

const { RateKeeper, mergeCurrencies } = await import("./processor.js");

const NOW = Date.parse("2026-11-12T10:00:00.000Z");
const op = [{}] as unknown as OperationWithContext[];

function host(more?: () => Promise<{ currency: string; since: string | null }[]>) {
  const writes: string[] = [];
  const dispatch = {
    createInDrive: vi.fn((driveId: string, document: { header: { name: string } }) => {
      writes.push(`create in ${driveId}: ${document.header.name}`);
      return Promise.resolve({ id: "job", status: "ok", documentId: "pair-1" });
    }),
    execute: vi.fn((id: string, _branch: string, actions: { type: string }[]) => {
      writes.push(`${id}: ${actions.map((a) => a.type).join(",")}`);
      return Promise.resolve({ id: "job", status: "ok" });
    }),
    deleteDocument: vi.fn(),
  };
  const keeper = new RateKeeper("drive-1", { dispatch }, () => ({}) as FinanceQueryBuilder, more);
  return { keeper, writes };
}

const service = (status: number, body: unknown) =>
  vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
  books.fail = false;
  books.pairs = [];
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("RateKeeper", () => {
  it("makes the pair and records its rates shortly after the books change", async () => {
    vi.stubGlobal("fetch", service(200, [{ date: "2026-11-11", base: "RON", quote: "EUR", rate: 0.187 }]));
    const { keeper, writes } = host();
    await keeper.onOperations(op);
    await keeper.onOperations(op);
    expect(writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(writes).toEqual([
      "create in drive-1: RON to EUR",
      "pair-1: SET_PAIR",
      "pair-1: RECORD_RATES",
    ]);
    await keeper.onDisconnect();
  });

  it("passes at startup and every hour, and not after it is disconnected", async () => {
    const fetcher = service(200, []);
    vi.stubGlobal("fetch", fetcher);
    const { keeper } = host();
    keeper.start();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    // within the refresh: the hourly pass asks nothing
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(6 * 3_600_000);
    expect(fetcher.mock.calls.length).toBeGreaterThan(1);
    const calls = fetcher.mock.calls.length;
    await keeper.onDisconnect();
    await keeper.onOperations(op);
    await vi.advanceTimersByTimeAsync(24 * 3_600_000);
    expect(fetcher).toHaveBeenCalledTimes(calls);
  });

  it("tries again by itself after the network failed", async () => {
    const fetcher = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    vi.stubGlobal("fetch", fetcher);
    const { keeper, writes } = host();
    await keeper.pass();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(writes).toEqual(["create in drive-1: RON to EUR", "pair-1: SET_PAIR"]);
    // back online: the retry records the rates on the pair it already made
    vi.stubGlobal("fetch", service(200, [{ date: "2026-11-11", base: "RON", quote: "EUR", rate: 0.187 }]));
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1_000);
    expect(writes).toEqual([
      "create in drive-1: RON to EUR",
      "pair-1: SET_PAIR",
      "pair-1: RECORD_RATES",
    ]);
    await keeper.onDisconnect();
  });

  it("does not keep asking for a currency nobody quotes", async () => {
    const fetcher = service(422, { message: "invalid currency" });
    vi.stubGlobal("fetch", fetcher);
    const { keeper } = host();
    await keeper.pass();
    const calls = fetcher.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(fetcher).toHaveBeenCalledTimes(calls);
    await keeper.onDisconnect();
  });

  it("survives a finance index that is not there yet", async () => {
    books.fail = true;
    const { keeper, writes } = host();
    await expect(keeper.pass()).resolves.toBeUndefined();
    expect(writes).toEqual([]);
  });

  it("keeps rates for the currencies of trips too, from the first trip, when a trip changes", async () => {
    const fetcher = vi.fn((url: string) =>
      Promise.resolve(
        new Response(
          JSON.stringify([{ date: "2026-11-11", base: url.includes("base=CHF") ? "CHF" : "RON", quote: "EUR", rate: 1 }]),
          { status: 200 },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    const { keeper, writes } = host(() =>
      Promise.resolve([
        { currency: "CHF", since: "2025-03-10" },
        // the books' own lei, used by a trip earlier than by any account
        { currency: "RON", since: "2026-02-01" },
      ]),
    );
    keeper.poke();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(writes.filter((w) => w.startsWith("create"))).toEqual([
      "create in drive-1: CHF to EUR",
      "create in drive-1: RON to EUR",
    ]);
    const asked = fetcher.mock.calls.map(([url]) => url);
    expect(asked.some((u) => u.includes("base=CHF") && u.includes("from=2025-03-03"))).toBe(true);
    expect(asked.some((u) => u.includes("base=RON") && u.includes("from=2026-01-25"))).toBe(true);
    await keeper.onDisconnect();
  });

  it("keeps the books' own rates when the trips cannot be read", async () => {
    vi.stubGlobal("fetch", service(200, [{ date: "2026-11-11", base: "RON", quote: "EUR", rate: 0.187 }]));
    const { keeper, writes } = host(() => Promise.reject(new Error("no trips drive")));
    await keeper.pass();
    expect(writes).toEqual([
      "create in drive-1: RON to EUR",
      "pair-1: SET_PAIR",
      "pair-1: RECORD_RATES",
    ]);
    await keeper.onDisconnect();
  });
});

describe("mergeCurrencies", () => {
  it("names each currency once, with its earliest day", () => {
    expect(
      mergeCurrencies(
        [
          { currency: "RON", since: "2026-10-01" },
          { currency: "EUR", since: null },
        ],
        [
          { currency: "RON", since: "2026-02-01" },
          { currency: "EUR", since: "2025-01-01" },
          { currency: "CHF", since: null },
          { currency: "CHF", since: null },
          { currency: "", since: "2020-01-01" },
          { currency: "RON", since: "2026-12-01" },
        ],
      ),
    ).toEqual([
      { currency: "CHF", since: null },
      { currency: "EUR", since: "2025-01-01" },
      { currency: "RON", since: "2026-02-01" },
    ]);
    expect(mergeCurrencies()).toEqual([]);
  });
});
