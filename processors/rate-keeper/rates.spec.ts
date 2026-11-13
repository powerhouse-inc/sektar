import { describe, expect, it } from "vitest";
import {
  fetchRates,
  fetchWindow,
  NoRatesError,
  pairsNeeded,
  parseRates,
  ratesUrl,
  shiftDay,
} from "./rates.js";

const pair = (base: string, quote: string) => ({
  id: `${base}-${quote}`,
  base,
  quote,
  rateCount: 0,
  firstDay: null,
  lastDay: null,
  lastRate: null,
  lastSource: null,
  lastFetchedAt: null,
});

describe("pairsNeeded", () => {
  it("names the currencies in use with no pair into the main currency", () => {
    const inUse = [
      { currency: "EUR", since: null },
      { currency: "USD", since: "2026-10-02" },
      { currency: "GBP", since: null },
      { currency: "CHF", since: null },
      { currency: "CHF", since: null },
      { currency: "bad", since: null },
    ];
    // GBP has a pair; the pair of CHF points at another currency
    expect(pairsNeeded("EUR", inUse, [pair("GBP", "EUR"), pair("CHF", "USD")])).toEqual(["CHF", "USD"]);
    expect(pairsNeeded("USD", inUse, [])).toEqual(["CHF", "EUR", "GBP"]);
  });
});

describe("fetchWindow", () => {
  const today = "2026-11-12";

  it("starts a new pair a week before the first day in use", () => {
    expect(fetchWindow({ firstDay: null, lastDay: null }, "2026-10-02", today)).toEqual({ from: "2026-09-25", to: today });
    // nothing dated yet: the last week
    expect(fetchWindow({ firstDay: null, lastDay: null }, null, today)).toEqual({ from: "2026-11-05", to: today });
    // a day in the future is not a reason to wait
    expect(fetchWindow({ firstDay: null, lastDay: null }, "2027-01-01", today)).toEqual({ from: "2026-11-05", to: today });
  });

  it("continues from the day after the last rate", () => {
    expect(fetchWindow({ firstDay: "2026-09-25", lastDay: "2026-11-10" }, "2026-10-02", today)).toEqual({ from: "2026-11-11", to: today });
  });

  it("is up to date once it holds today's rate", () => {
    expect(fetchWindow({ firstDay: "2026-09-25", lastDay: today }, "2026-10-02", today)).toBeNull();
  });

  it("does not go back for a pair that starts after a weekend's lead", () => {
    // asked from Saturday 26 Sept, the first rate is Monday's: still before the first day in use
    expect(fetchWindow({ firstDay: "2026-09-28", lastDay: "2026-11-10" }, "2026-10-03", today)).toEqual({ from: "2026-11-11", to: today });
    // and its first rate on the very first day in use is enough
    expect(fetchWindow({ firstDay: "2026-10-03", lastDay: "2026-11-10" }, "2026-10-03", today)).toEqual({ from: "2026-11-11", to: today });
  });

  it("goes back when older amounts arrive", () => {
    expect(fetchWindow({ firstDay: "2026-09-25", lastDay: today }, "2026-03-10", today)).toEqual({ from: "2026-03-03", to: today });
  });
});

describe("parseRates", () => {
  it("keeps the pair's valid days, in order, once each", () => {
    expect(
      parseRates(
        [
          { date: "2026-11-10", base: "USD", quote: "EUR", rate: 0.89 },
          { date: "2026-11-09", base: "USD", quote: "EUR", rate: 0.9 },
          { date: "2026-11-09", base: "USD", quote: "EUR", rate: 0.91 },
          { date: "2026-11-10", base: "GBP", quote: "EUR", rate: 1.2 },
          { date: "2026-11-11", base: "USD", quote: "EUR", rate: 0 },
          { date: "11 Nov", base: "USD", quote: "EUR", rate: 0.9 },
          { date: "2026-11-12", base: "USD", quote: "EUR", rate: "0.9" },
          null,
          "row",
        ],
        "USD",
        "EUR",
      ),
    ).toEqual([
      { date: "2026-11-09T00:00:00.000Z", rate: 0.91 },
      { date: "2026-11-10T00:00:00.000Z", rate: 0.89 },
    ]);
    expect(parseRates({ status: 422 }, "USD", "EUR")).toEqual([]);
  });
});

describe("fetchRates", () => {
  const window = { from: "2026-11-09", to: "2026-11-10" };
  const urlOf = (input: Parameters<typeof fetch>[0]) =>
    typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const answer = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status });

  it("asks the ECB first", async () => {
    const asked: string[] = [];
    const result = await fetchRates("USD", "EUR", window, (url) => {
      asked.push(urlOf(url));
      return Promise.resolve(answer(200, [{ date: "2026-11-10", base: "USD", quote: "EUR", rate: 0.89 }]));
    });
    expect(asked).toEqual([ratesUrl("USD", "EUR", window, "ecb")]);
    expect(asked[0]).toBe(
      "https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR&from=2026-11-09&to=2026-11-10&providers=ecb",
    );
    expect(result).toEqual({ source: "ECB", rates: [{ date: "2026-11-10T00:00:00.000Z", rate: 0.89 }] });
  });

  it("falls back to the blend for a currency the ECB does not quote", async () => {
    const result = await fetchRates("AED", "EUR", window, (url) =>
      Promise.resolve(
        urlOf(url).includes("providers=ecb")
          ? answer(422, { message: "ECB doesn't quote AED" })
          : answer(200, [{ date: "2026-11-10", base: "AED", quote: "EUR", rate: 0.24 }]),
      ),
    );
    expect(result).toEqual({ source: "Frankfurter", rates: [{ date: "2026-11-10T00:00:00.000Z", rate: 0.24 }] });
  });

  it("rejects a currency nobody quotes, for good", async () => {
    const refused = fetchRates("XXX", "EUR", window, () => Promise.resolve(answer(422, {})));
    await expect(refused).rejects.toThrow("No exchange rates for XXX to EUR (422)");
    await expect(refused).rejects.toBeInstanceOf(NoRatesError);
  });

  it("rejects a service that cannot answer now as worth another try", async () => {
    for (const status of [429, 500, 503]) {
      const failed = fetchRates("USD", "EUR", window, () => Promise.resolve(answer(status, {})));
      await expect(failed).rejects.toThrow(`No exchange rates for USD to EUR (${String(status)})`);
      await expect(failed).rejects.not.toBeInstanceOf(NoRatesError);
    }
  });
});

describe("shiftDay", () => {
  it("moves across months and years", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });
});
