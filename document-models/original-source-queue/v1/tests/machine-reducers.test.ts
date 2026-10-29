/**
 * The state machine, driven through the real reducers.
 *
 * `odometer.spec.ts` proves the arithmetic in isolation. This file proves the
 * document behaves like the machine: that statuses gate what they claim to,
 * that derived fields are actually written, and that a walk through the
 * reducers produces the same sequence as nested `for` loops.
 *
 * Errors are asserted through `operations.global[i].error`, never `.toThrow()`
 * — a throwing reducer still records its operation, with the message on it and
 * the state left untouched.
 */
import {
  addCollectionValue,
  clearCollection,
  createCollection,
  createCollectionCursor,
  createDateTimeCursor,
  createNumberCursor,
  pause,
  proceed,
  proceedWithError,
  reducer,
  reorderCursors,
  reportError,
  reset,
  setCursorName,
  start,
  terminate,
  unpause,
  updateMemory,
  utils,
  isCollectionCursor,
  isDateTimeCursor,
  isNumberCursor,
  type OriginalSourceQueueDocument,
} from "document-models/original-source-queue/v1";
import { describe, expect, it } from "vitest";


type Doc = OriginalSourceQueueDocument;

/** The error recorded by the nth dispatched operation, if any. */
function errorAt(document: Doc, index: number): string | undefined {
  return document.operations.global[index]?.error;
}

/** What the cursors currently read, in order. */
function tuple(document: Doc): (string | number | null)[] {
  return document.state.global.cursors.map((cursor) => cursor.current ?? null);
}

/** A draft with year/week/weekday loops: the worked example from the spec. */
function threeLoopDraft(): Doc {
  let document = utils.createDocument();
  document = reducer(
    document,
    createCollection({
      id: "col-days",
      name: "Weekdays",
      values: ["Monday", "Tuesday", "Wednesday", "Thursday"],
    }),
  );
  document = reducer(
    document,
    createNumberCursor({
      id: "cur-year",
      name: "Year",
      first: 2025,
      last: 2026,
      step: 1,
    }),
  );
  document = reducer(
    document,
    createNumberCursor({
      id: "cur-week",
      name: "Week",
      first: 1,
      last: 52,
      step: 1,
    }),
  );
  return reducer(
    document,
    createCollectionCursor({
      id: "cur-day",
      name: "Weekday",
      collection: "col-days",
    }),
  );
}

describe("defining a queue", () => {
  it("calculates count up front, so the size is known before starting", () => {
    const document = threeLoopDraft();
    const counts = document.state.global.cursors.map((c) => c.count);
    expect(counts).toEqual([2, 52, 4]);
    // A draft has not handed anything out.
    expect(tuple(document)).toEqual([null, null, null]);
    expect(document.state.global.progress).toBe(0);
    expect(document.state.global.status).toBe("DRAFT");
  });

  it("refuses a step that would never terminate", () => {
    const document = reducer(
      utils.createDocument(),
      createNumberCursor({ id: "c", first: 1, last: 9, step: 0 }),
    );
    expect(errorAt(document, 0)).toContain("step must be greater than zero");
    expect(document.state.global.cursors).toHaveLength(0);
  });

  it("refuses a time span with no interval in it", () => {
    const document = reducer(
      utils.createDocument(),
      createDateTimeCursor({
        id: "c",
        first: "2024-01-01T00:00:00.000Z",
        last: "2024-01-01T00:00:00.000Z",
        deltaSeconds: 86400,
      }),
    );
    expect(errorAt(document, 0)).toContain("same instant");
  });

  it("refuses a cursor over a collection that does not exist", () => {
    const document = reducer(
      utils.createDocument(),
      createCollectionCursor({ id: "c", collection: "nope" }),
    );
    expect(errorAt(document, 0)).toContain("no collection nope");
  });

  it("refuses an order that is not a permutation of the cursors", () => {
    const draft = threeLoopDraft();
    const document = reducer(
      draft,
      reorderCursors({ order: ["cur-year", "cur-week"] }),
    );
    expect(errorAt(document, 4)).toContain("exactly once");
    // Unchanged, rather than partially applied.
    expect(document.state.global.cursors.map((c) => c.id)).toEqual([
      "cur-year",
      "cur-week",
      "cur-day",
    ]);
  });

  it("renests the loops when reordered", () => {
    const draft = threeLoopDraft();
    const document = reducer(
      draft,
      reorderCursors({ order: ["cur-day", "cur-year", "cur-week"] }),
    );
    expect(document.state.global.cursors.map((c) => c.id)).toEqual([
      "cur-day",
      "cur-year",
      "cur-week",
    ]);
  });
});

describe("walking, through the reducers", () => {
  it("produces exactly what three nested for loops produce", () => {
    const expected: (string | number)[][] = [];
    for (let year = 2025; year <= 2026; year++) {
      for (let w = 1; w <= 52; w++) {
        for (let day = 0; day < 4; day++) expected.push([year, w, day]);
      }
    }

    let document = reducer(threeLoopDraft(), start({}));
    const seen: (string | number | null)[][] = [tuple(document)];
    for (let n = 1; n < 416; n++) {
      document = reducer(document, proceed({}));
      seen.push(tuple(document));
    }

    expect(seen).toEqual(expected);
    expect(document.state.global.status).toBe("IN_PROGRESS");

    // One more finishes it rather than handing out a 417th tuple.
    document = reducer(document, proceed({}));
    expect(document.state.global.status).toBe("FINISHED");
    expect(document.state.global.progress).toBe(1);
    expect(tuple(document)).toEqual([null, null, null]);
    expect(document.state.global.cursors.every((c) => c.finished)).toBe(true);
  });

  it("gives a time cursor a usable range at every step", () => {
    let document = reducer(
      utils.createDocument(),
      createDateTimeCursor({
        id: "weeks",
        first: "2024-01-01T00:00:00.000Z",
        last: "2024-01-29T00:00:00.000Z",
        deltaSeconds: 7 * 24 * 3600,
      }),
    );
    document = reducer(document, start({}));

    const ranges: [string, string][] = [];
    for (let n = 0; n < 4; n++) {
      const cursor = document.state.global.cursors[0];
      if (!isDateTimeCursor(cursor)) throw new Error("expected a time cursor");
      const { current, next } = cursor;
      // Asserting the contract rather than silencing the type: a running time
      // cursor always has both ends, which is what makes the range usable.
      if (current == null || next == null) {
        throw new Error("a running interval must have both ends");
      }
      ranges.push([current, next]);
      document = reducer(document, proceed({}));
    }

    expect(ranges[0]).toEqual([
      "2024-01-01T00:00:00.000Z",
      "2024-01-08T00:00:00.000Z",
    ]);
    // Contiguous, and the last one closes exactly on `last`.
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i][0]).toBe(ranges[i - 1][1]);
    }
    expect(ranges[3][1]).toBe("2024-01-29T00:00:00.000Z");
    expect(document.state.global.status).toBe("FINISHED");
  });

  it("walks time newest-first when the bounds are reversed", () => {
    let document = reducer(
      utils.createDocument(),
      createDateTimeCursor({
        id: "weeks",
        first: "2024-01-29T00:00:00.000Z",
        last: "2024-01-01T00:00:00.000Z",
        deltaSeconds: 7 * 24 * 3600,
      }),
    );
    document = reducer(document, start({}));

    const cursor = document.state.global.cursors[0];
    if (!isDateTimeCursor(cursor)) throw new Error("expected a time cursor");
    // The most recent week comes first, and the interval is still forwards.
    expect(cursor.current).toBe("2024-01-22T00:00:00.000Z");
    expect(cursor.next).toBe("2024-01-29T00:00:00.000Z");
  });

  it("counts a number cursor down when last is below first", () => {
    let document = reducer(
      utils.createDocument(),
      createNumberCursor({ id: "weeks", first: 52, last: 50, step: 1 }),
    );
    document = reducer(document, start({}));
    const seen: (string | number | null)[] = [tuple(document)[0]];
    document = reducer(document, proceed({}));
    seen.push(tuple(document)[0]);
    document = reducer(document, proceed({}));
    seen.push(tuple(document)[0]);
    expect(seen).toEqual([52, 51, 50]);
  });
});

describe("queues that fill while the walk runs", () => {
  function queueDraft(seed: unknown[] = []): Doc {
    let document = reducer(
      utils.createDocument(),
      createCollection({ id: "files", name: "Files", values: seed }),
    );
    document = reducer(
      document,
      createCollectionCursor({ id: "cur-file", collection: "files" }),
    );
    return document;
  }

  it("waits on an empty queue instead of finishing", () => {
    const document = reducer(queueDraft(), start({}));
    // The distinction the whole discover-then-drain pattern rests on.
    expect(document.state.global.status).toBe("IN_PROGRESS");
    expect(document.state.global.awaitingValues).toBe(true);
    expect(tuple(document)).toEqual([null]);
  });

  it("hands out the first value that arrives, losing no work", () => {
    let document = reducer(queueDraft(), start({}));
    document = reducer(
      document,
      addCollectionValue({ collection: "files", values: ["a.pdf", "b.pdf"] }),
    );
    // Queuing is not itself an iteration: it stays parked until the advance.
    expect(document.state.global.awaitingValues).toBe(true);

    document = reducer(document, proceed({}));
    expect(document.state.global.awaitingValues).toBe(false);
    // Index 0 — the value pushed first, not skipped past.
    expect(tuple(document)).toEqual([0]);

    document = reducer(document, proceed({}));
    expect(tuple(document)).toEqual([1]);
    document = reducer(document, proceed({}));
    expect(document.state.global.status).toBe("FINISHED");
  });

  it("picks up work discovered after it had caught up", () => {
    let document = reducer(queueDraft(["a.pdf"]), start({}));
    expect(tuple(document)).toEqual([0]);

    document = reducer(
      document,
      addCollectionValue({ collection: "files", values: ["b.pdf"] }),
    );
    document = reducer(document, proceed({}));
    expect(document.state.global.status).toBe("IN_PROGRESS");
    expect(tuple(document)).toEqual([1]);
  });

  it("treats values arriving after a clear as new work", () => {
    let document = reducer(queueDraft(["a.pdf", "b.pdf"]), start({}));
    document = reducer(document, proceed({}));
    expect(tuple(document)).toEqual([1]);

    document = reducer(document, clearCollection({ collection: "files" }));
    expect(document.state.global.awaitingValues).toBe(true);

    document = reducer(
      document,
      addCollectionValue({ collection: "files", values: ["c.pdf"] }),
    );
    document = reducer(document, proceed({}));
    // Back to the top: c.pdf has not been worked, and would have been lost if
    // the clear were read as a plain shrink.
    expect(tuple(document)).toEqual([0]);
    expect(document.state.global.status).toBe("IN_PROGRESS");
  });

  it("refuses a push that queues nothing", () => {
    const document = reducer(
      reducer(queueDraft(["a"]), start({})),
      addCollectionValue({ collection: "files", values: [] }),
    );
    expect(errorAt(document, 3)).toContain("queue nothing");
  });
});

describe("recording failures", () => {
  it("stamps an error with the tuple that produced it", () => {
    let document = reducer(threeLoopDraft(), start({}));
    document = reducer(document, proceed({})); // year 2025, week 1, Tuesday

    document = reducer(
      document,
      reportError({ id: "e1", message: "rate limited", data: { status: 429 } }),
    );

    const recorded = document.state.global.errors[0];
    expect(recorded.message).toBe("rate limited");
    // Values, not indices: "Tuesday", not 1 — an index means nothing after a
    // clear, whereas the value still names the work.
    expect(recorded.cursors.map((c) => c.value)).toEqual([2025, 1, "Tuesday"]);
    // Reporting does not move the walk.
    expect(tuple(document)).toEqual([2025, 1, 1]);
  });

  it("stamps before advancing, so the error names the slice that failed", () => {
    let document = reducer(threeLoopDraft(), start({}));
    document = reducer(
      document,
      proceedWithError({ id: "e1", message: "boom" }),
    );

    const recorded = document.state.global.errors[0];
    // The tuple it failed on, not the one it moved to.
    expect(recorded.cursors.map((c) => c.value)).toEqual([2025, 1, "Monday"]);
    expect(tuple(document)).toEqual([2025, 1, 1]);
  });

  it("refuses to reuse an error id, which would erase an earlier failure", () => {
    let document = reducer(threeLoopDraft(), start({}));
    document = reducer(document, reportError({ id: "e1", message: "one" }));
    document = reducer(document, reportError({ id: "e1", message: "two" }));
    expect(errorAt(document, 6)).toContain("already recorded");
    expect(document.state.global.errors).toHaveLength(1);
    expect(document.state.global.errors[0].message).toBe("one");
  });
});

describe("moving only from the tuple a caller worked on", () => {
  /** The tuple as the For Every trigger hands it out: ids and values. */
  function handedOut(document: Doc): { cursor: string; value: unknown }[] {
    const { cursors, collections } = document.state.global;
    return cursors.map((cursor) => ({
      cursor: cursor.id,
      value: isCollectionCursor(cursor)
        ? (collections.find((c) => c.id === cursor.collection)?.values[
            cursor.current ?? -1
          ] ?? null)
        : (cursor.current ?? null),
    }));
  }

  it("moves when the queue is still on that tuple", () => {
    let document = reducer(threeLoopDraft(), start({}));
    const monday = handedOut(document);
    document = reducer(document, proceed({ expected: monday }));
    expect(errorAt(document, 5)).toBeUndefined();
    expect(tuple(document)).toEqual([2025, 1, 1]);
  });

  it("refuses a second move from the same tuple, so the next is not skipped", () => {
    let document = reducer(threeLoopDraft(), start({}));
    const monday = handedOut(document);
    document = reducer(document, proceed({ expected: monday }));
    document = reducer(document, proceed({ expected: monday }));
    expect(errorAt(document, 6)).toContain("no longer on the tuple");
    // Still on Tuesday: the one the second run never worked on.
    expect(tuple(document)).toEqual([2025, 1, 1]);
  });

  it("refuses a tuple that names other cursors", () => {
    let document = reducer(threeLoopDraft(), start({}));
    const [year, week] = handedOut(document);
    document = reducer(document, proceed({ expected: [year, week] }));
    document = reducer(
      document,
      proceed({
        expected: [year, week, { cursor: "cur-month", value: "Monday" }],
      }),
    );
    expect(errorAt(document, 5)).toContain("no longer on the tuple");
    expect(errorAt(document, 6)).toContain("no longer on the tuple");
    expect(tuple(document)).toEqual([2025, 1, 0]);
  });

  it("compares a time cursor by its instant", () => {
    let document = reducer(
      utils.createDocument(),
      createDateTimeCursor({
        id: "days",
        first: "2024-01-01T00:00:00.000Z",
        last: "2024-01-04T00:00:00.000Z",
        deltaSeconds: 86400,
      }),
    );
    document = reducer(document, start({}));
    const first = handedOut(document);
    expect(first).toEqual([
      { cursor: "days", value: "2024-01-01T00:00:00.000Z" },
    ]);
    document = reducer(
      document,
      proceed({
        expected: [{ cursor: "days", value: "2024-01-02T00:00:00.000Z" }],
      }),
    );
    expect(errorAt(document, 2)).toContain("no longer on the tuple");
    document = reducer(document, proceed({ expected: first }));
    expect(errorAt(document, 3)).toBeUndefined();
    expect(tuple(document)).toEqual(["2024-01-02T00:00:00.000Z"]);
  });

  it("matches nothing while the queue waits for values", () => {
    let document = reducer(
      utils.createDocument(),
      createCollection({ id: "files", name: "Files", values: [] }),
    );
    document = reducer(
      document,
      createCollectionCursor({ id: "cur-file", collection: "files" }),
    );
    document = reducer(document, start({}));
    document = reducer(
      document,
      proceed({ expected: [{ cursor: "cur-file", value: null }] }),
    );
    expect(errorAt(document, 3)).toContain("no longer on the tuple");
    expect(document.state.global.awaitingValues).toBe(true);
  });

  it("records a failure only against the tuple the caller worked on", () => {
    let document = reducer(threeLoopDraft(), start({}));
    const monday = handedOut(document);
    document = reducer(
      document,
      proceedWithError({ id: "e1", message: "boom", expected: monday }),
    );
    document = reducer(
      document,
      proceedWithError({ id: "e2", message: "late", expected: monday }),
    );
    expect(errorAt(document, 5)).toBeUndefined();
    expect(errorAt(document, 6)).toContain("stamped on the wrong one");
    // The late report neither lands on Tuesday nor moves past it.
    expect(document.state.global.errors.map((e) => e.id)).toEqual(["e1"]);
    expect(tuple(document)).toEqual([2025, 1, 1]);
  });
});

describe("status gates every operation that claims one", () => {
  it("will not start anything but a draft", () => {
    const running = reducer(threeLoopDraft(), start({}));
    const again = reducer(running, start({}));
    expect(errorAt(again, 5)).toContain("Only a draft can be started");
  });

  it("will not start a queue that describes no loop", () => {
    const document = reducer(utils.createDocument(), start({}));
    expect(errorAt(document, 0)).toContain("no cursors");
    expect(document.state.global.status).toBe("DRAFT");
  });

  it("will not change the shape of a running walk", () => {
    const running = reducer(threeLoopDraft(), start({}));
    const added = reducer(
      running,
      createNumberCursor({ id: "late", first: 1, last: 2, step: 1 }),
    );
    expect(errorAt(added, 5)).toContain("only be added to a draft");
    expect(added.state.global.cursors).toHaveLength(3);

    const renamed = reducer(running, setCursorName({ id: "cur-year", name: "X" }));
    expect(errorAt(renamed, 5)).toContain("only change in a draft");
  });

  it("will not advance a paused or finished walk", () => {
    const paused = reducer(reducer(threeLoopDraft(), start({})), pause({}));
    const nudged = reducer(paused, proceed({}));
    expect(errorAt(nudged, 6)).toContain("Only a walk in progress can advance");
    expect(nudged.state.global.status).toBe("PAUSED");
  });

  it("resumes a paused walk on the tuple it stopped on", () => {
    let document = reducer(threeLoopDraft(), start({}));
    document = reducer(document, proceed({}));
    const before = tuple(document);
    document = reducer(document, pause({}));
    document = reducer(document, unpause({}));
    expect(document.state.global.status).toBe("IN_PROGRESS");
    expect(tuple(document)).toEqual(before);
  });

  it("will not queue values unless the walk is running", () => {
    const draft = threeLoopDraft();
    const document = reducer(
      draft,
      addCollectionValue({ collection: "col-days", values: ["Friday"] }),
    );
    expect(errorAt(document, 4)).toContain("while the walk is in progress");
  });

  it("will not resume something that is not paused", () => {
    const running = reducer(threeLoopDraft(), start({}));
    expect(errorAt(reducer(running, unpause({})), 5)).toContain(
      "Only a paused walk",
    );
  });

  it("will not terminate twice", () => {
    const done = reducer(reducer(threeLoopDraft(), start({})), terminate({}));
    expect(done.state.global.status).toBe("FINISHED");
    expect(errorAt(reducer(done, terminate({})), 6)).toContain(
      "already finished",
    );
  });

  it("will not reset a draft", () => {
    expect(errorAt(reducer(threeLoopDraft(), reset({})), 4)).toContain(
      "already a draft",
    );
  });
});

describe("resetting", () => {
  it("keeps the space and discards what the run produced", () => {
    let document = reducer(threeLoopDraft(), start({}));
    document = reducer(document, proceed({}));
    document = reducer(document, reportError({ id: "e1", message: "boom" }));
    document = reducer(
      document,
      updateMemory({ key: "pageToken", value: "abc" }),
    );
    document = reducer(document, reset({}));

    const state = document.state.global;
    expect(state.status).toBe("DRAFT");
    // Definitions and queued values survive: a reset is for running the same
    // space again after fixing something.
    expect(state.cursors).toHaveLength(3);
    expect(state.collections[0].values).toHaveLength(4);
    expect(state.cursors.map((c) => c.count)).toEqual([2, 52, 4]);
    // Everything the run produced does not.
    expect(state.errors).toHaveLength(0);
    expect(state.memory).toHaveLength(0);
    expect(state.progress).toBe(0);
    expect(state.cursors.every((c) => c.position === 0)).toBe(true);
    expect(tuple(document)).toEqual([null, null, null]);
  });

  it("can be walked again after a reset", () => {
    let document = reducer(threeLoopDraft(), start({}));
    document = reducer(document, proceed({}));
    document = reducer(document, reset({}));
    document = reducer(document, start({}));
    expect(tuple(document)).toEqual([2025, 1, 0]);
  });
});

describe("memory", () => {
  it("carries a value across iterations", () => {
    let document = reducer(threeLoopDraft(), start({}));
    document = reducer(
      document,
      updateMemory({ key: "pageToken", value: "tok-1" }),
    );
    document = reducer(document, proceed({}));
    expect(document.state.global.memory).toEqual([
      { key: "pageToken", value: "tok-1" },
    ]);
  });

  it("replaces a slot rather than appending a second one", () => {
    let document = reducer(threeLoopDraft(), start({}));
    document = reducer(document, updateMemory({ key: "n", value: 1 }));
    document = reducer(document, updateMemory({ key: "n", value: 2 }));
    expect(document.state.global.memory).toEqual([{ key: "n", value: 2 }]);
  });

  it("removes a slot when the value is cleared", () => {
    let document = reducer(threeLoopDraft(), start({}));
    document = reducer(document, updateMemory({ key: "n", value: 1 }));
    document = reducer(document, updateMemory({ key: "n", value: null }));
    expect(document.state.global.memory).toHaveLength(0);
  });

  it("refuses an unnameable slot", () => {
    const document = reducer(
      reducer(threeLoopDraft(), start({})),
      updateMemory({ key: "   ", value: 1 }),
    );
    expect(errorAt(document, 5)).toContain("needs a name");
  });

  it("refuses to write to a finished queue", () => {
    const done = reducer(reducer(threeLoopDraft(), start({})), terminate({}));
    expect(errorAt(reducer(done, updateMemory({ key: "n", value: 1 })), 6)).toContain(
      "has finished",
    );
  });
});

describe("cursor kinds are distinguishable without a __typename", () => {
  it("narrows each kind by the field only it has", () => {
    const document = threeLoopDraft();
    const [year, , day] = document.state.global.cursors;
    expect(isNumberCursor(year)).toBe(true);
    expect(isCollectionCursor(day)).toBe(true);
    expect(isDateTimeCursor(year)).toBe(false);
  });
});
