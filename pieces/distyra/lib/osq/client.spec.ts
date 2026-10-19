/**
 * The shape a flow actually consumes.
 *
 * This is the layer where a wrong answer is quiet: a flow reading
 * `values.week` gets *something* whatever happens, and a collection cursor
 * handing back an index instead of a value looks like data until a Gmail
 * query is run against the number 0. So the tests are about what a flow
 * receives, not about whether the call succeeded.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import { shapeOf, slugOf, stateOf, type QueueState } from "./client.js";

function queue(over: Partial<QueueState> = {}): QueueState {
  return {
    status: "IN_PROGRESS",
    progress: 4 / 806,
    awaitingValues: false,
    collections: [{ id: "col", name: "Labels", values: ["INBOX", "SENT"] }],
    cursors: [
      {
        id: "cur-week",
        name: "Week",
        position: 2,
        count: 403,
        finished: false,
        current: "2026-09-07T00:00:00.000Z",
        next: "2026-09-14T00:00:00.000Z",
        deltaSeconds: 604800,
      },
      {
        id: "cur-label",
        name: "Label",
        position: 0,
        count: 2,
        finished: false,
        current: 0,
        next: 1,
        collection: "col",
      },
    ],
    memory: [{ key: "pageToken", value: "abc" }],
    errors: [],
    ...over,
  };
}

describe("naming cursors for a flow expression", () => {
  it("turns a display name into something writable", () => {
    expect(slugOf({ id: "a", name: "Week of year", position: 0, count: 1, finished: false }, 0)).toBe("week_of_year");
    expect(slugOf({ id: "a", name: "  Card #4967 ", position: 0, count: 1, finished: false }, 0)).toBe("card_4967");
  });

  it("falls back to a position when a cursor has no name", () => {
    // Unnamed is legitimate; an expression still has to be able to reach it.
    expect(slugOf({ id: "a", position: 0, count: 1, finished: false }, 0)).toBe("cursor_1");
    expect(slugOf({ id: "a", name: "", position: 0, count: 1, finished: false }, 2)).toBe("cursor_3");
  });
});

describe("what a flow receives", () => {
  it("hands back a queued value, never its index", () => {
    // The index is the machine's business. A flow searching Gmail for the
    // label "0" would fail in a way that looks like a Gmail problem.
    const shape = shapeOf("doc-1", queue());
    expect(shape.values.label).toBe("INBOX");
    expect(shape.cursors[1].next).toBe("SENT");
  });

  it("gives a time cursor a ready-made range", () => {
    const shape = shapeOf("doc-1", queue());
    expect(shape.ranges.week).toEqual({
      from: "2026-09-07T00:00:00.000Z",
      to: "2026-09-14T00:00:00.000Z",
    });
    // Only time cursors get one: a range over a label means nothing.
    expect(shape.ranges.label).toBeUndefined();
  });

  it("counts the iteration from one, and the space from the counts", () => {
    const shape = shapeOf("doc-1", queue());
    expect(shape.total).toBe(806);
    // Fifth tuple: START plus four advances.
    expect(shape.iteration).toBe(5);
  });

  it("flattens memory into something addressable by name", () => {
    expect(shapeOf("doc-1", queue()).memory).toEqual({ pageToken: "abc" });
  });

  it("reports nothing rather than guessing when a queue is parked", () => {
    const shape = shapeOf(
      "doc-1",
      queue({
        awaitingValues: true,
        cursors: [
          {
            id: "cur-file",
            name: "File",
            position: 0,
            count: 0,
            finished: false,
            current: null,
            collection: "col",
          },
        ],
      }),
    );
    expect(shape.values.file).toBeNull();
    expect(shape.awaitingValues).toBe(true);
    // No tuples to walk yet, so no ordinal to claim.
    expect(shape.total).toBe(0);
    expect(shape.iteration).toBe(0);
  });

  it("survives a value the collection no longer holds", () => {
    // A cursor pointing past a shrunken queue must read as absent, not throw
    // inside a trigger where the failure would look like a reactor fault.
    const shape = shapeOf(
      "doc-1",
      queue({
        collections: [{ id: "col", name: "Labels", values: [] }],
      }),
    );
    expect(shape.values.label).toBeNull();
  });
});

describe("unwrapping what the reactor returns", () => {
  it("accepts state with or without its scope wrapper", () => {
    const bare = queue();
    expect(stateOf(bare).status).toBe("IN_PROGRESS");
    expect(stateOf({ global: bare }).status).toBe("IN_PROGRESS");
  });

  it("says so plainly when the document is not a queue", () => {
    // Better than a TypeError three frames deep in a trigger.
    expect(() => stateOf({ something: "else" })).toThrow(
      /did not come back with a queue state/,
    );
    expect(() => stateOf(null)).toThrow(/queue state/);
  });

  it("fills in defaults rather than handing back holes", () => {
    const state = stateOf({ cursors: [] });
    expect(state.status).toBe("DRAFT");
    expect(state.collections).toEqual([]);
    expect(state.memory).toEqual([]);
  });
});
