import {
  recordRates,
  reducer,
  removeRate,
  setManualRate,
  setPair,
  utils,
  type CurrencyPairDocument,
} from "document-models/currency-pair/v1";
import { describe, expect, it } from "vitest";

const T = "2026-11-12T16:30:00.000Z";
const lastError = (doc: CurrencyPairDocument) =>
  doc.operations.global.at(-1)?.error;

function usdEur(): CurrencyPairDocument {
  return reducer(utils.createDocument(), setPair({ base: "usd", quote: " eur " }));
}

function withRates(): CurrencyPairDocument {
  return reducer(
    usdEur(),
    recordRates({
      source: "ECB",
      fetchedAt: T,
      rates: [
        { id: "r2", date: "2026-11-11T00:00:00.000Z", rate: 0.8987 },
        { id: "r1", date: "2026-11-10T00:00:00.000Z", rate: 0.9001 },
      ],
    }),
  );
}

describe("currency pair", () => {
  it("names the pair in capitals", () => {
    const doc = usdEur();
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global).toEqual({
      base: "USD",
      quote: "EUR",
      rates: [],
      lastFetchedAt: null,
    });
  });

  it("refuses a pair that is not two different currency codes", () => {
    let doc = reducer(utils.createDocument(), setPair({ base: "US", quote: "EUR" }));
    expect(lastError(doc)).toBe(
      '"US" and "EUR" must be three-letter currency codes',
    );
    doc = reducer(doc, setPair({ base: "USD", quote: "euro" }));
    expect(lastError(doc)).toBe(
      '"USD" and "euro" must be three-letter currency codes',
    );
    doc = reducer(doc, setPair({ base: "EUR", quote: "eur" }));
    expect(lastError(doc)).toBe("A currency needs no rate to itself");
    expect(doc.state.global.base).toBeNull();
  });

  it("records fetched rates, the oldest first", () => {
    const doc = withRates();
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global.rates).toEqual([
      { id: "r1", date: "2026-11-10T00:00:00.000Z", rate: 0.9001, source: "ECB", manual: false },
      { id: "r2", date: "2026-11-11T00:00:00.000Z", rate: 0.8987, source: "ECB", manual: false },
    ]);
    expect(doc.state.global.lastFetchedAt).toBe(T);
  });

  it("keeps the pair once it holds rates, and takes the same pair again", () => {
    let doc = reducer(withRates(), setPair({ base: "GBP", quote: "EUR" }));
    expect(lastError(doc)).toBe("The pair cannot change once it holds rates");
    doc = reducer(doc, setPair({ base: "USD", quote: "USD" }));
    expect(lastError(doc)).toBe("A currency needs no rate to itself");
    doc = reducer(doc, setPair({ base: "USD", quote: "GBP" }));
    expect(lastError(doc)).toBe("The pair cannot change once it holds rates");
    doc = reducer(doc, setPair({ base: "USD", quote: "EUR" }));
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global.base).toBe("USD");
  });

  it("replaces a fetched day on a rerun and never a day entered by hand", () => {
    let doc = reducer(
      withRates(),
      setManualRate({ id: "m1", date: "2026-11-10T00:00:00.000Z", rate: 0.91 }),
    );
    doc = reducer(doc, setManualRate({ id: "m2", date: "2026-11-09T00:00:00.000Z", rate: 0.92 }));
    expect(doc.state.global.rates.map((r) => r.date.slice(0, 10))).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
    ]);
    doc = reducer(
      doc,
      recordRates({
        source: "Frankfurter",
        fetchedAt: "2026-11-13T16:30:00.000Z",
        rates: [
          { id: "x1", date: "2026-11-10T00:00:00.000Z", rate: 0.5 },
          { id: "x2", date: "2026-11-11T00:00:00.000Z", rate: 0.8999 },
          { id: "x3", date: "2026-11-12T00:00:00.000Z", rate: 0.8976 },
        ],
      }),
    );
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global.rates).toEqual([
      { id: "m2", date: "2026-11-09T00:00:00.000Z", rate: 0.92, source: "Manual", manual: true },
      { id: "r1", date: "2026-11-10T00:00:00.000Z", rate: 0.91, source: "Manual", manual: true },
      { id: "r2", date: "2026-11-11T00:00:00.000Z", rate: 0.8999, source: "Frankfurter", manual: false },
      { id: "x3", date: "2026-11-12T00:00:00.000Z", rate: 0.8976, source: "Frankfurter", manual: false },
    ]);
    expect(doc.state.global.lastFetchedAt).toBe("2026-11-13T16:30:00.000Z");
  });

  it("refuses a batch it cannot record whole", () => {
    let doc = reducer(
      utils.createDocument(),
      recordRates({
        source: "ECB",
        fetchedAt: T,
        rates: [{ id: "r1", date: "2026-11-10T00:00:00.000Z", rate: 0.9 }],
      }),
    );
    expect(lastError(doc)).toBe("Name the two currencies first");
    doc = reducer(doc, setManualRate({ id: "m1", date: "2026-11-10T00:00:00.000Z", rate: 0.9 }));
    expect(lastError(doc)).toBe("Name the two currencies first");

    doc = reducer(usdEur(), recordRates({ source: "ECB", fetchedAt: T, rates: [] }));
    expect(lastError(doc)).toBe("Nothing to record");
    for (const rate of [0, -1]) {
      doc = reducer(
        doc,
        recordRates({
          source: "ECB",
          fetchedAt: T,
          rates: [{ id: "r1", date: "2026-11-10T00:00:00.000Z", rate }],
        }),
      );
      expect(lastError(doc)).toBe("A rate must be above zero (2026-11-10)");
    }
    doc = reducer(
      doc,
      recordRates({
        source: "ECB",
        fetchedAt: T,
        rates: [
          { id: "r1", date: "2026-11-10T00:00:00.000Z", rate: 0.9 },
          { id: "r2", date: "2026-11-10T12:00:00.000Z", rate: 0.91 },
        ],
      }),
    );
    expect(lastError(doc)).toBe("2026-11-10 is in the batch twice");
    expect(doc.state.global.rates).toEqual([]);
    expect(doc.state.global.lastFetchedAt).toBeNull();
  });

  it("refuses a manual rate that is not above zero", () => {
    let doc = usdEur();
    for (const rate of [0, -0.5]) {
      doc = reducer(doc, setManualRate({ id: "m1", date: "2026-11-10T00:00:00.000Z", rate }));
      expect(lastError(doc)).toBe("A rate must be above zero");
    }
    expect(doc.state.global.rates).toEqual([]);
  });

  it("removes the rate of a day, and says so when there is none", () => {
    let doc = reducer(withRates(), removeRate({ date: "2026-11-10T00:00:00.000Z" }));
    expect(lastError(doc)).toBeUndefined();
    expect(doc.state.global.rates.map((r) => r.date.slice(0, 10))).toEqual([
      "2026-11-11",
    ]);
    doc = reducer(doc, removeRate({ date: "2026-11-10T00:00:00.000Z" }));
    expect(lastError(doc)).toBe("No rate for 2026-11-10");
    expect(doc.state.global.rates).toHaveLength(1);
  });
});
