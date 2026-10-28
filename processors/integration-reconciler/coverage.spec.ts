import { describe, expect, it } from "vitest";
import { coverageGaps, spanLabel, type Span } from "./coverage.js";

const d = (iso: string) => Date.parse(`${iso}T00:00:00.000Z`);
const span = (from: string, to: string): Span => ({ from: d(from), to: d(to) });

describe("coverage", () => {
  it("finds the hole between Personal's long backfill and its 2026 quarters", () => {
    const personal = [
      span("2004-08-31", "2025-08-12"),
      span("2026-01-01", "2026-07-01"),
      span("2026-07-01", "2026-10-01"),
      span("2026-10-01", "2027-01-01"),
    ];
    const gaps = coverageGaps(personal);
    expect(gaps).toEqual([span("2025-08-12", "2026-01-01")]);
    expect(spanLabel(gaps[0])).toBe("12 Aug 2025 – 1 Jan 2026");
  });

  it("finds nothing where backfills touch or overlap, in any order", () => {
    expect(
      coverageGaps([
        span("2026-10-28", "2027-10-28"),
        span("2026-01-01", "2026-10-28"),
      ]),
    ).toEqual([]);
    expect(
      coverageGaps([
        span("2020-01-01", "2023-01-01"),
        span("2022-01-01", "2024-01-01"),
      ]),
    ).toEqual([]);
    // Under a day is not a gap
    expect(
      coverageGaps([
        { from: d("2026-01-01"), to: d("2026-01-02") - 3_600_000 },
        span("2026-01-02", "2026-02-01"),
      ]),
    ).toEqual([]);
    expect(coverageGaps([])).toEqual([]);
  });

  it("finds every hole, a short span inside a long one counting for nothing", () => {
    expect(
      coverageGaps([
        span("2010-01-01", "2020-01-01"),
        span("2012-01-01", "2013-01-01"),
        span("2021-01-01", "2022-01-01"),
        span("2023-01-01", "2024-01-01"),
      ]),
    ).toEqual([
      span("2020-01-01", "2021-01-01"),
      span("2022-01-01", "2023-01-01"),
    ]);
  });
});
