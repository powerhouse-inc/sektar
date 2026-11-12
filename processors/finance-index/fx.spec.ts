import { describe, expect, it } from "vitest";
import { dayOf, Fx, parseOwnRates, roundMoney } from "./fx.js";

const rates = [
  { base: "USD", day: "2026-11-06", rate: 0.9 },
  { base: "USD", day: "2026-11-09", rate: 0.8 },
  { base: "USD", day: "2026-11-10", rate: 0.7 },
  { base: "GBP", day: "2026-11-10", rate: 1.2 },
];

describe("Fx", () => {
  it("leaves the main currency as it is", () => {
    const fx = new Fx("EUR", rates);
    expect(fx.rate("EUR")).toBe(1);
    expect(fx.convert(100, "EUR", "2020-01-01")).toBe(100);
    expect(fx.unconverted()).toEqual([]);
  });

  it("takes the latest rate when no day is asked for", () => {
    const fx = new Fx("EUR", rates);
    expect(fx.rate("USD")).toBe(0.7);
    expect(fx.convert(100, "USD")).toBe(70);
  });

  it("takes the rate of the day, or the latest before it", () => {
    const fx = new Fx("EUR", [...rates].reverse());
    expect(fx.rate("USD", "2026-11-09")).toBe(0.8);
    // a weekend: Friday's rate
    expect(fx.rate("USD", "2026-11-08T12:00:00.000Z")).toBe(0.9);
    expect(fx.rate("USD", "2027-01-01")).toBe(0.7);
  });

  it("takes the earliest rate for a day before any", () => {
    expect(new Fx("EUR", rates).rate("USD", "2026-01-01")).toBe(0.9);
  });

  it("leaves out a currency with no rate and names it", () => {
    const fx = new Fx("EUR", rates);
    expect(fx.convert(100, "CHF")).toBeNull();
    expect(fx.convert(100, "AUD", "2026-11-10")).toBeNull();
    expect(fx.unconverted()).toEqual(["AUD", "CHF"]);
  });

  it("never goes through the inverse or a third currency", () => {
    // the books are in USD: the EUR-quoted rates above say nothing
    const fx = new Fx("USD", [{ base: "EUR", day: "2026-11-10", rate: 1.1 }]);
    expect(fx.rate("EUR")).toBe(1.1);
    expect(fx.rate("GBP")).toBeNull();
  });

  it("ignores a rate of the main currency to itself, a rate of zero and a second rate for a day", () => {
    const fx = new Fx("EUR", [
      { base: "EUR", day: "2026-11-10", rate: 2 },
      { base: "USD", day: "2026-11-10", rate: 0 },
      { base: "GBP", day: "2026-11-10", rate: 1.2 },
      { base: "GBP", day: "2026-11-10", rate: 9 },
    ]);
    expect(fx.rate("EUR")).toBe(1);
    expect(fx.rate("USD")).toBeNull();
    expect(fx.rate("GBP")).toBe(1.2);
  });

  it("converts an invoice at its own rate first", () => {
    const fx = new Fx("EUR", rates);
    expect(fx.convertInvoice(100, "EUR", [])).toBe(100);
    expect(
      fx.convertInvoice(100, "USD", [{ base: "USD", quote: "EUR", rate: 0.5 }]),
    ).toBe(50);
    expect(
      fx.convertInvoice(100, "USD", [{ base: "EUR", quote: "USD", rate: 2 }]),
    ).toBe(50);
    // a rate for another pair, or one that is not above zero, is no rate
    expect(
      fx.convertInvoice(100, "USD", [
        { base: "USD", quote: "GBP", rate: 0.5 },
        { base: "USD", quote: "EUR", rate: 0 },
        { base: "EUR", quote: "USD", rate: 0 },
      ]),
    ).toBe(70);
    expect(fx.convertInvoice(100, "CHF", [])).toBeNull();
    expect(fx.unconverted()).toEqual(["CHF"]);
  });
});

describe("helpers", () => {
  it("reads the day of an instant", () => {
    expect(dayOf("2026-11-10T09:00:00.000Z")).toBe("2026-11-10");
    expect(dayOf("2026-11-10")).toBe("2026-11-10");
    expect(dayOf("soon")).toBeNull();
    expect(dayOf(null)).toBeNull();
    expect(dayOf(undefined)).toBeNull();
  });

  it("reads an invoice's own rates, and nothing from anything else", () => {
    expect(
      parseOwnRates('[{"base":"USD","quote":"EUR","rate":0.9},{"base":1},null]'),
    ).toEqual([{ base: "USD", quote: "EUR", rate: 0.9 }]);
    expect(parseOwnRates("{}")).toEqual([]);
    expect(parseOwnRates("not json")).toEqual([]);
    expect(parseOwnRates(null)).toEqual([]);
  });

  it("rounds to cents", () => {
    expect(roundMoney(1.005 + 0.004)).toBe(1.01);
    expect(roundMoney(69.999)).toBe(70);
  });
});
