/**
 * Naming a slice after the day it covers.
 *
 * The expression language resolves paths and nothing else, so a flow that
 * names a document after a day needs the day handed to it already formed.
 */
import { describe, expect, it } from "vitest";
import { datesOf } from "./read-slice.js";

describe("calendar dates for a range", () => {
  it("takes the day out of each bound", () => {
    expect(
      datesOf({
        day: { from: "2026-09-29T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" },
      }),
    ).toEqual({ day: { from: "2026-09-29", to: "2026-09-30" } });
  });

  it("gives every time cursor its own entry", () => {
    const dates = datesOf({
      day: { from: "2026-09-29T00:00:00.000Z", to: "2026-09-30T00:00:00.000Z" },
      month: { from: "2026-09-01T00:00:00.000Z", to: "2026-10-01T00:00:00.000Z" },
    });
    expect(Object.keys(dates)).toEqual(["day", "month"]);
    expect(dates.month.from).toBe("2026-09-01");
  });

  it("says null rather than inventing a date", () => {
    // The upper bound of a finished cursor is null, and a document named
    // after "null".slice(0,10) would be worse than one that fails to name.
    expect(datesOf({ day: { from: null, to: undefined } })).toEqual({
      day: { from: null, to: null },
    });
    expect(datesOf({ day: { from: "short", to: 42 } })).toEqual({
      day: { from: null, to: null },
    });
  });

  it("has nothing to say about a queue with no time cursor", () => {
    expect(datesOf({})).toEqual({});
  });
});
