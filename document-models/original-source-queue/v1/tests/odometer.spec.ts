/**
 * The odometer, checked against a plain nested `for` loop.
 *
 * This machine's whole job is to produce the same sequence a human would write
 * as nested loops. So the central test does not assert hand-picked tuples — it
 * enumerates all 416 of them and diffs against three real `for` loops. Any
 * mistake in carrying, resetting, or ordering shows up as a diff rather than as
 * a guess about which assertion to write.
 *
 * `.spec.ts`, not `.test.ts`, so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import {
  countOf,
  initial,
  progressOf,
  step,
  totalCount,
  valueAt,
  type CursorSpec,
  type Odometer,
} from "../src/odometer.js";

const week = 7 * 24 * 3600;

/** Walk the machine to exhaustion, collecting the tuple at each stop. */
function walk(specs: CursorSpec[], limit = 5000) {
  const tuples: (string | number | null)[][] = [];
  const outcomes: string[] = [];
  let od: Odometer = initial(specs);
  for (let n = 0; n < limit; n++) {
    const result = step(specs, od);
    od = result.odometer;
    outcomes.push(result.outcome);
    if (result.outcome === "EXHAUSTED" || result.outcome === "PARKED") break;
    tuples.push(specs.map((s, i) => valueAt(s, od.positions[i]).current));
  }
  return { tuples, outcomes, odometer: od };
}

describe("counting", () => {
  it("counts points, in either direction", () => {
    expect(countOf({ kind: "number", first: 1, last: 52, step: 1 })).toBe(52);
    // Travelling down is the same distance, not an empty range.
    expect(countOf({ kind: "number", first: 52, last: 1, step: 1 })).toBe(52);
    expect(countOf({ kind: "number", first: 5, last: 5, step: 1 })).toBe(1);
    // A step wider than the span still yields the starting point.
    expect(countOf({ kind: "number", first: 1, last: 2, step: 5 })).toBe(1);
    expect(countOf({ kind: "number", first: 10, last: 1, step: 3 })).toBe(4);
  });

  it("treats a non-positive step as nothing to walk", () => {
    expect(countOf({ kind: "number", first: 1, last: 9, step: 0 })).toBe(0);
    expect(countOf({ kind: "number", first: 1, last: 9, step: -1 })).toBe(0);
  });

  it("counts intervals for time, not points", () => {
    const spec: CursorSpec = {
      kind: "datetime",
      first: "2024-01-01T00:00:00.000Z",
      last: "2024-01-29T00:00:00.000Z",
      deltaSeconds: week,
    };
    // 28 days is exactly 4 weekly intervals — 5 points, 4 gaps.
    expect(countOf(spec)).toBe(4);
    // Reversing the bounds walks the same intervals backwards.
    expect(countOf({ ...spec, first: spec.last, last: spec.first })).toBe(4);
  });

  it("gives a partial period its own interval", () => {
    // 30 days is 4 whole weeks and a remainder; the remainder still needs
    // fetching, so it rounds up rather than being dropped.
    expect(
      countOf({
        kind: "datetime",
        first: "2024-01-01T00:00:00.000Z",
        last: "2024-01-31T00:00:00.000Z",
        deltaSeconds: week,
      }),
    ).toBe(5);
  });

  it("has no interval to hand out across a zero-width span", () => {
    expect(
      countOf({
        kind: "datetime",
        first: "2024-01-01T00:00:00.000Z",
        last: "2024-01-01T00:00:00.000Z",
        deltaSeconds: week,
      }),
    ).toBe(0);
  });
});

describe("reading a cursor", () => {
  it("walks numbers up and back down", () => {
    const up: CursorSpec = { kind: "number", first: 1, last: 4, step: 1 };
    expect([0, 1, 2, 3].map((i) => valueAt(up, i).current)).toEqual([1, 2, 3, 4]);
    expect(valueAt(up, 3).next).toBeNull();

    const down: CursorSpec = { kind: "number", first: 4, last: 1, step: 1 };
    expect([0, 1, 2, 3].map((i) => valueAt(down, i).current)).toEqual([4, 3, 2, 1]);
    // For points, `next` is simply the following value in travel order.
    expect(valueAt(down, 0).next).toBe(3);
  });

  it("covers the span with touching intervals, the last one clipped", () => {
    const spec: CursorSpec = {
      kind: "datetime",
      first: "2024-01-01T00:00:00.000Z",
      last: "2024-01-31T00:00:00.000Z",
      deltaSeconds: week,
    };
    const parts = [0, 1, 2, 3, 4].map((i) => valueAt(spec, i));

    // No gap: each interval starts where the previous one ended.
    for (let i = 1; i < parts.length; i++) {
      expect(parts[i].current).toBe(parts[i - 1].next);
    }
    expect(parts[0].current).toBe("2024-01-01T00:00:00.000Z");
    // Clipped to `last`, so the cover has no overhang past the bound asked for.
    expect(parts[4].next).toBe("2024-01-31T00:00:00.000Z");
  });

  it("walks time backwards without inverting any interval", () => {
    const down: CursorSpec = {
      kind: "datetime",
      first: "2024-01-31T00:00:00.000Z",
      last: "2024-01-01T00:00:00.000Z",
      deltaSeconds: week,
    };
    const parts = [0, 1, 2, 3, 4].map((i) => valueAt(down, i));

    // Newest first — the point of counting down on a backfill.
    expect(parts[0].next).toBe("2024-01-31T00:00:00.000Z");
    expect(parts[4].current).toBe("2024-01-01T00:00:00.000Z");
    // Every interval remains a usable [current, next) range regardless of
    // travel direction; only the visiting order reversed.
    for (const part of parts) {
      expect(String(part.current) < String(part.next)).toBe(true);
    }
  });

  it("reads nothing outside its range", () => {
    const spec: CursorSpec = { kind: "number", first: 1, last: 3, step: 1 };
    expect(valueAt(spec, 3)).toEqual({ current: null, next: null });
    expect(valueAt(spec, -1)).toEqual({ current: null, next: null });
  });
});

describe("the odometer against real nested loops", () => {
  const specs: CursorSpec[] = [
    { kind: "number", first: 2025, last: 2026, step: 1 },
    { kind: "number", first: 1, last: 52, step: 1 },
    { kind: "collection", length: 4 },
  ];

  it("produces exactly what three nested for loops produce", () => {
    const expected: number[][] = [];
    for (let year = 2025; year <= 2026; year++) {
      for (let w = 1; w <= 52; w++) {
        for (let day = 0; day < 4; day++) expected.push([year, w, day]);
      }
    }
    expect(expected).toHaveLength(416);
    expect(totalCount(specs)).toBe(416);

    const { tuples, outcomes } = walk(specs);
    expect(tuples).toEqual(expected);
    // 416 stops, then one more call that finds the space walked.
    expect(outcomes.filter((o) => o === "RUNNING")).toHaveLength(416);
    expect(outcomes[outcomes.length - 1]).toBe("EXHAUSTED");
  });

  it("produces the descending sequence when the bounds are reversed", () => {
    const down: CursorSpec[] = [
      { kind: "number", first: 2026, last: 2025, step: 1 },
      { kind: "number", first: 52, last: 1, step: 1 },
    ];
    const expected: number[][] = [];
    for (let year = 2026; year >= 2025; year--) {
      for (let w = 52; w >= 1; w--) expected.push([year, w]);
    }

    expect(walk(down).tuples).toEqual(expected);
  });

  it("resets deeper cursors when an outer one moves", () => {
    // The difference between a foreach and a diagonal walk.
    const small: CursorSpec[] = [
      { kind: "number", first: 1, last: 3, step: 1 },
      { kind: "number", first: 7, last: 8, step: 1 },
    ];
    expect(walk(small).tuples).toEqual([
      [1, 7], [1, 8],
      [2, 7], [2, 8],
      [3, 7], [3, 8],
    ]);
  });
});

describe("edges that stall a naive loop", () => {
  it("finishes immediately with no cursors at all", () => {
    // Zero cursors is zero tuples, not one empty tuple.
    expect(step([], initial([])).outcome).toBe("EXHAUSTED");
  });

  it("finishes when a static cursor can never yield anything", () => {
    // A zero-width span cannot fill later: its bounds are fixed.
    const specs: CursorSpec[] = [
      {
        kind: "datetime",
        first: "2024-01-01T00:00:00.000Z",
        last: "2024-01-01T00:00:00.000Z",
        deltaSeconds: week,
      },
    ];
    expect(step(specs, initial(specs)).outcome).toBe("EXHAUSTED");
  });

  it("parks on an empty queue instead of finishing, and loses no iteration", () => {
    // The discovery-then-drain shape: finishing here would deadlock, since a
    // finished queue can never be added to.
    const empty: CursorSpec[] = [{ kind: "collection", length: 0 }];
    const parked = step(empty, initial(empty));
    expect(parked.outcome).toBe("PARKED");

    // Work arrives. The first value must be handed out, not skipped past —
    // this is exactly what the `entered` flag protects.
    const filled: CursorSpec[] = [{ kind: "collection", length: 2 }];
    const first = step(filled, parked.odometer);
    expect(first.outcome).toBe("RUNNING");
    expect(valueAt(filled[0], first.odometer.positions[0]).current).toBe(0);

    const second = step(filled, first.odometer);
    expect(valueAt(filled[0], second.odometer.positions[0]).current).toBe(1);
    expect(step(filled, second.odometer).outcome).toBe("EXHAUSTED");
  });

  it("picks up values pushed onto a queue mid-run", () => {
    let specs: CursorSpec[] = [{ kind: "collection", length: 1 }];
    let od = initial(specs);

    od = step(specs, od).odometer; // index 0
    // A queue is not a fixed list: the loop is not finished just because it
    // has caught up with what it knew about.
    specs = [{ kind: "collection", length: 3 }];
    const next = step(specs, od);
    expect(next.outcome).toBe("RUNNING");
    expect(next.odometer.positions[0]).toBe(1);
  });

  it("parks while a queue is empty, whenever it emptied", () => {
    const three: CursorSpec[] = [{ kind: "collection", length: 3 }];
    let od = step(three, initial(three)).odometer;
    od = step(three, od).odometer; // at index 1

    const cleared: CursorSpec[] = [{ kind: "collection", length: 0 }];
    expect(step(cleared, od).outcome).toBe("PARKED");
  });

  it("does not re-hand work when a queue merely shrinks", () => {
    // Length alone cannot distinguish "three items, two now gone" from
    // "cleared and refilled with new work". Read on its own, a shorter queue
    // means the items above the cursor no longer exist, so there is nothing
    // left to do — re-handing the survivor would repeat completed work.
    // Announcing a refill is CLEAR_COLLECTION's job, exercised below.
    const three: CursorSpec[] = [{ kind: "collection", length: 3 }];
    let od = step(three, initial(three)).odometer;
    od = step(three, od).odometer; // at index 1

    const shrunk: CursorSpec[] = [{ kind: "collection", length: 1 }];
    expect(step(shrunk, od).outcome).toBe("EXHAUSTED");
  });

  it("starts a refilled queue from the top once the clear is announced", () => {
    // The contract CLEAR_COLLECTION relies on: it marks the cursor
    // un-entered, and the machine then hands out the new index 0 rather than
    // advancing past it.
    const refilled: CursorSpec[] = [{ kind: "collection", length: 2 }];
    const afterClear: Odometer = { positions: [0], entered: false };

    const resumed = step(refilled, afterClear);
    expect(resumed.outcome).toBe("RUNNING");
    expect(resumed.odometer.positions[0]).toBe(0);
  });

  it("keeps an outer loop alive while an inner queue is empty", () => {
    const specs: CursorSpec[] = [
      { kind: "number", first: 1, last: 2, step: 1 },
      { kind: "collection", length: 0 },
    ];
    // Waiting, not finished — the outer years have not been walked yet.
    expect(step(specs, initial(specs)).outcome).toBe("PARKED");
  });
});

describe("progress", () => {
  const specs: CursorSpec[] = [{ kind: "number", first: 1, last: 4, step: 1 }];

  it("is nothing before the first tuple is handed out", () => {
    expect(progressOf(specs, initial(specs))).toBe(0);
  });

  it("climbs as the walk proceeds", () => {
    let od = initial(specs);
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      od = step(specs, od).odometer;
      seen.push(progressOf(specs, od));
    }
    expect(seen).toEqual([0, 0.25, 0.5, 0.75]);
    // The last tuple is not "done" — it is the work still to do. FINISHED is
    // what makes it 1, and that is the reducer's call, not the odometer's.
  });

  it("reports nothing for a space with no tuples", () => {
    expect(progressOf([], initial([]))).toBe(0);
  });
});
