/**
 * What the trip index writes for a document.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import { foldYears, searchWords, toTripRow } from "./queries.js";
import {
  costsOf,
  emptyRow,
  firstLegOf,
  nightsOf,
  parseState,
  rowFromState,
  tripPhase,
} from "./rows.js";

const AT = "2026-10-20T08:00:00.000Z";

const state = {
  title: "Copenhagen - Sky offsite",
  status: "BOOKED",
  purpose: "Offsite with the Sky team",
  purposeKind: "OFFSITE",
  currency: "EUR",
  startDate: "2026-11-03",
  endDate: "2026-11-06",
  traveler: { name: "Wouter", email: "w@example.com" },
  billing: { billable: true, customerName: "Sky ApS" },
  destinations: [
    { id: "d1", city: "Copenhagen", country: "DK" },
    { id: "d2", city: "Malmo", country: null },
  ],
  transport: [
    {
      id: "t2",
      mode: "TRAIN",
      carrier: "DSB",
      number: "IC 5",
      from: "CPH",
      to: "MMX",
      departAt: "2026-11-05T09:00:00Z",
      cost: { amount: 20, currency: "EUR", converted: null },
    },
    {
      id: "t1",
      mode: "FLIGHT",
      carrier: "KLM",
      number: "KL1143",
      from: "AMS",
      to: "CPH",
      departAt: "2026-11-03T07:00:00Z",
      cost: { amount: 150.5, currency: "EUR", converted: null },
      invoice: { invoiceId: "inv-1" },
    },
    {
      id: "t3",
      mode: "FLIGHT",
      carrier: "KLM",
      from: "CPH",
      to: "AMS",
      departAt: "2026-11-06T18:00:00Z",
      cost: { amount: 100, currency: "DKK", converted: 13.4 },
    },
  ],
  stays: [
    {
      id: "s1",
      name: "Hotel Alma",
      checkIn: "2026-11-03",
      checkOut: "2026-11-05",
      cost: { amount: 300, currency: "EUR", converted: null },
    },
    {
      id: "s2",
      name: "Airbnb Malmo",
      checkIn: "2026-11-05",
      checkOut: "2026-11-06",
      cost: { amount: 900, currency: "SEK", converted: null },
    },
    { id: "s3", name: "No dates", checkIn: null, checkOut: null },
  ],
  meals: [{ id: "m1", cost: { amount: 45, currency: "EUR", converted: null } }],
  extras: [],
};

describe("a row from a trip's state", () => {
  it("takes what the list shows and what a filter needs", () => {
    const row = rowFromState("d1", state, AT);
    expect(row).toMatchObject({
      document_id: "d1",
      title: "Copenhagen - Sky offsite",
      status: "BOOKED",
      purpose_kind: "OFFSITE",
      start_date: "2026-11-03",
      end_date: "2026-11-06",
      traveler_name: "Wouter",
      currency: "EUR",
      flights: 2,
      nights: 3,
      days: 4,
      updated_at: AT,
    });
    expect(JSON.parse(row.destinations)).toEqual([
      { city: "Copenhagen", country: "DK" },
      { city: "Malmo", country: null },
    ]);
  });

  it("sums the costs in the trip's currency, converted where it differs, unknown left out", () => {
    // 20 + 150.5 + 13.4 (converted) + 300 + 45; the SEK stay has no converted amount
    const row = rowFromState("d1", state, AT);
    expect(row.cost_total).toBe(528.9);
    expect(row.billed_total).toBe(150.5);
    expect(costsOf({}, "EUR")).toEqual({
      total: 0,
      billed: 0,
      byKind: { transport: 0, stays: 0, meals: 0, extras: 0 },
    });
    expect(
      row.cost_transport + row.cost_stays + row.cost_meals + row.cost_extras,
    ).toBeCloseTo(row.cost_total, 2);
  });

  it("keeps the earliest leg by departure as the first leg", () => {
    const row = rowFromState("d1", state, AT);
    expect(JSON.parse(row.first_leg ?? "null")).toEqual({
      mode: "FLIGHT",
      carrier: "KLM",
      number: "KL1143",
      from: "AMS",
      to: "CPH",
      departAt: "2026-11-03T07:00:00Z",
    });
    expect(firstLegOf([])).toBeNull();
    expect(firstLegOf([{ mode: "CAR" }, { mode: "BUS", departAt: "2026-01-01T00:00:00Z" }])).toMatchObject({
      mode: "BUS",
    });
  });

  it("builds a lower-cased search haystack", () => {
    const text = rowFromState("d1", state, AT).search_text;
    for (const word of ["copenhagen", "wouter", "sky aps", "malmo", "hotel alma", "klm", "dk"]) {
      expect(text).toContain(word);
    }
    expect(text).toBe(text.toLowerCase());
  });

  it("copes with an empty document", () => {
    const row = rowFromState("d2", {}, AT);
    expect(row).toEqual({ ...emptyRow("d2", AT), search_text: "" });
    expect(row.first_leg).toBeNull();
    expect(row.days).toBe(1);
  });
});

describe("nights", () => {
  it("is the sum of check-out minus check-in, never negative, skipping open stays", () => {
    expect(
      nightsOf([
        { checkIn: "2026-11-03", checkOut: "2026-11-05" },
        { checkIn: "2026-11-09", checkOut: "2026-11-08" },
        { checkIn: "2026-11-10T14:00:00Z", checkOut: "2026-11-11T10:00:00Z" },
        { checkIn: "2026-11-12", checkOut: null },
      ]),
    ).toBe(3);
  });
});

describe("the phase", () => {
  const at = (iso: string) => Date.parse(iso);
  const trip = (status: string, start: string | null, end: string | null) => ({
    status,
    start_date: start,
    end_date: end,
  });

  it("follows the kit's phaseOf", () => {
    expect(tripPhase(trip("BOOKED", "2026-11-03", "2026-11-06"), at("2026-11-02T23:00:00Z"))).toBe("upcoming");
    expect(tripPhase(trip("BOOKED", "2026-11-03", "2026-11-06"), at("2026-11-03T00:00:00Z"))).toBe("ongoing");
    expect(tripPhase(trip("BOOKED", "2026-11-03", "2026-11-06"), at("2026-11-06T20:00:00Z"))).toBe("ongoing");
    expect(tripPhase(trip("BOOKED", "2026-11-03", "2026-11-06"), at("2026-11-07T00:00:00Z"))).toBe("completed");
    expect(tripPhase(trip("PLANNED", "2026-11-03", null), at("2026-11-03T12:00:00Z"))).toBe("ongoing");
    expect(tripPhase(trip("PLANNED", "2026-11-03", null), at("2026-11-04T12:00:00Z"))).toBe("completed");
    expect(tripPhase(trip("CANCELLED", "2026-11-03", null), at("2026-11-01T00:00:00Z"))).toBe("cancelled");
    expect(tripPhase(trip("PLANNED", null, null))).toBe("undated");
    expect(tripPhase(trip("COMPLETED", null, null))).toBe("completed");
  });

  it("is carried on the list row, measured at the request's now", () => {
    const row = rowFromState("d1", state, AT);
    expect(toTripRow({ ...row }, new Date("2026-10-01T00:00:00Z")).phase).toBe("upcoming");
    expect(toTripRow({ ...row }, new Date("2026-12-01T00:00:00Z")).phase).toBe("completed");
  });
});

describe("the list row", () => {
  it("maps the stored JSON to the subgraph's vocabulary", () => {
    const row = toTripRow(rowFromState("d1", state, AT), new Date("2026-11-04T00:00:00Z"));
    expect(row).toMatchObject({
      id: "d1",
      title: "Copenhagen - Sky offsite",
      purposeKind: "OFFSITE",
      startDate: "2026-11-03",
      travelerName: "Wouter",
      flights: 2,
      nights: 3,
      costTotal: 528.9,
      currency: "EUR",
      phase: "ongoing",
    });
    expect(row.destinations).toHaveLength(2);
    expect(row.firstLeg?.number).toBe("KL1143");
  });
});

describe("the per-year figures", () => {
  it("fold the lean rows, newest year first", () => {
    const a = rowFromState("a", state, AT);
    const b = rowFromState("b", { ...state, startDate: "2025-05-01", endDate: "2025-05-02" }, AT);
    expect(foldYears([a, b, a])).toEqual([
      { year: 2026, trips: 2, flights: 4, legs: 6, nights: 6, days: 8, cost: 1057.8, billed: 301, costByKind: { transport: 2 * a.cost_transport, stays: 2 * a.cost_stays, meals: 2 * a.cost_meals, extras: 2 * a.cost_extras } },
      { year: 2025, trips: 1, flights: 2, legs: 3, nights: 3, days: 2, cost: 528.9, billed: 150.5, costByKind: { transport: a.cost_transport, stays: a.cost_stays, meals: a.cost_meals, extras: a.cost_extras } },
    ]);
    expect(foldYears([])).toEqual([]);
  });
});

describe("the operation's state", () => {
  it("is the global scope, bare or wrapped", () => {
    expect(parseState(JSON.stringify({ title: "x" }))).toEqual({ title: "x" });
    expect(parseState(JSON.stringify({ global: { title: "y" } }))).toEqual({ title: "y" });
  });

  it("is null when absent or not JSON, so the row stays as it is", () => {
    expect(parseState(undefined)).toBeNull();
    expect(parseState("")).toBeNull();
    expect(parseState("{nope")).toBeNull();
  });
});

describe("a search", () => {
  it("is lower-cased words, capped", () => {
    expect(searchWords("  Copenhagen  KLM ")).toEqual(["copenhagen", "klm"]);
    expect(searchWords(null)).toEqual([]);
    expect(searchWords("a b c d e f g")).toHaveLength(6);
  });
});
