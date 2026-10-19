/**
 * Every refusal, exercised.
 *
 * `machine-reducers.test.ts` covers the shapes a working queue moves through.
 * This file covers the ones it refuses: each named error is a branch, and a
 * guard nobody has ever tripped is a guard nobody knows works. Asserted via
 * `operations.global[i].error` — a throwing reducer still records its
 * operation and leaves the state alone.
 */
import {
  addCollectionValue,
  clearCollection,
  createCollection,
  createCollectionCursor,
  createDateTimeCursor,
  createNumberCursor,
  proceedWithError,
  reducer,
  reorderCursors,
  reportError,
  setCursorDescription,
  setCursorName,
  setDescription,
  start,
  updateMemory,
  utils,
  type OriginalSourceQueueDocument,
} from "document-models/original-source-queue/v1";
import { describe, expect, it } from "vitest";

type Doc = OriginalSourceQueueDocument;

function errorAt(document: Doc, index: number): string | undefined {
  return document.operations.global[index]?.error;
}

/** A draft holding one collection and one number cursor. */
function draft(): Doc {
  let document = reducer(
    utils.createDocument(),
    createCollection({ id: "col", name: "Queue", values: ["a"] }),
  );
  return reducer(
    document,
    createNumberCursor({ id: "num", first: 1, last: 3, step: 1 }),
  );
}

/** That draft, running. Operation indices continue from 2. */
function running(): Doc {
  return reducer(draft(), start({}));
}

describe("defining: refusals", () => {
  it("refuses a duplicate cursor id, whichever kind asks", () => {
    const base = draft();

    const sameNumber = reducer(
      base,
      createNumberCursor({ id: "num", first: 1, last: 2, step: 1 }),
    );
    expect(errorAt(sameNumber, 2)).toContain("already exists");

    const sameTime = reducer(
      base,
      createDateTimeCursor({
        id: "num",
        first: "2024-01-01T00:00:00.000Z",
        last: "2024-02-01T00:00:00.000Z",
        deltaSeconds: 86400,
      }),
    );
    expect(errorAt(sameTime, 2)).toContain("already exists");

    const sameCollection = reducer(
      base,
      createCollectionCursor({ id: "num", collection: "col" }),
    );
    expect(errorAt(sameCollection, 2)).toContain("already exists");
  });

  it("refuses a non-positive interval width", () => {
    const document = reducer(
      draft(),
      createDateTimeCursor({
        id: "t",
        first: "2024-01-01T00:00:00.000Z",
        last: "2024-02-01T00:00:00.000Z",
        deltaSeconds: 0,
      }),
    );
    expect(errorAt(document, 2)).toContain("greater than zero");
  });

  it("refuses a duplicate collection id", () => {
    const document = reducer(
      draft(),
      createCollection({ id: "col", name: "Again" }),
    );
    expect(errorAt(document, 2)).toContain("already exists");
    expect(document.state.global.collections).toHaveLength(1);
  });

  it("refuses every definition change once the walk has started", () => {
    const live = running();

    expect(
      errorAt(
        reducer(
          live,
          createDateTimeCursor({
            id: "t",
            first: "2024-01-01T00:00:00.000Z",
            last: "2024-02-01T00:00:00.000Z",
            deltaSeconds: 86400,
          }),
        ),
        3,
      ),
    ).toContain("only be added to a draft");

    expect(
      errorAt(
        reducer(live, createCollectionCursor({ id: "c2", collection: "col" })),
        3,
      ),
    ).toContain("only be added to a draft");

    expect(
      errorAt(reducer(live, reorderCursors({ order: ["num"] })), 3),
    ).toContain("only change in a draft");

    expect(
      errorAt(reducer(live, createCollection({ id: "c2", name: "Late" })), 3),
    ).toContain("only be defined in a draft");
  });

  it("renames a cursor, and refuses to rename one that is not there", () => {
    const named = reducer(draft(), setCursorName({ id: "num", name: "Weeks" }));
    expect(named.state.global.cursors[0].name).toBe("Weeks");

    // Clearing a name is legitimate, not a missing argument.
    const cleared = reducer(named, setCursorName({ id: "num" }));
    expect(cleared.state.global.cursors[0].name).toBeNull();

    expect(errorAt(reducer(draft(), setCursorName({ id: "ghost" })), 2)).toContain(
      "no cursor ghost",
    );
  });

  it("seeds a collection with no values when none are given", () => {
    const document = reducer(
      utils.createDocument(),
      createCollection({ id: "empty", name: "Empty" }),
    );
    expect(document.state.global.collections[0].values).toEqual([]);
  });
});

describe("queues: refusals", () => {
  it("refuses to push to, or clear, a collection that does not exist", () => {
    const live = running();
    expect(
      errorAt(
        reducer(live, addCollectionValue({ collection: "ghost", values: [1] })),
        3,
      ),
    ).toContain("no collection ghost");
    expect(
      errorAt(reducer(live, clearCollection({ collection: "ghost" })), 3),
    ).toContain("no collection ghost");
  });

  it("clears a queue nothing is walking without disturbing the walk", () => {
    // No cursor is bound to this collection, so there is no position to
    // rewind and the walk must carry on untouched.
    const live = running();
    const cleared = reducer(live, clearCollection({ collection: "col" }));
    expect(errorAt(cleared, 3)).toBeUndefined();
    expect(cleared.state.global.collections[0].values).toEqual([]);
    expect(cleared.state.global.awaitingValues).toBe(false);
    expect(cleared.state.global.cursors[0].current).toBe(1);
  });
});

describe("errors: refusals", () => {
  it("refuses a reused id when advancing with an error", () => {
    let document = reducer(running(), proceedWithError({ id: "e", message: "one" }));
    document = reducer(document, proceedWithError({ id: "e", message: "two" }));
    expect(errorAt(document, 4)).toContain("already recorded");
    expect(document.state.global.errors).toHaveLength(1);
  });

  it("carries structured data and still advances", () => {
    const document = reducer(
      running(),
      proceedWithError({
        id: "e",
        message: "rate limited",
        data: { status: 429 },
      }),
    );
    expect(errorAt(document, 3)).toBeUndefined();
    expect(document.state.global.errors[0].data).toEqual({ status: 429 });
    // Recording a failure does not cost an iteration.
    expect(document.state.global.cursors[0].current).toBe(2);
  });

  it("records no data when none is given", () => {
    const document = reducer(running(), reportError({ id: "e", message: "x" }));
    expect(document.state.global.errors[0].data).toBeNull();
  });
});

describe("memory: edges", () => {
  it("treats an omitted value the same as a cleared one", () => {
    let document = reducer(running(), updateMemory({ key: "k", value: 1 }));
    document = reducer(document, updateMemory({ key: "k" }));
    expect(document.state.global.memory).toHaveLength(0);
  });

  it("ignores a clear for a slot that was never written", () => {
    const document = reducer(running(), updateMemory({ key: "never" }));
    expect(errorAt(document, 3)).toBeUndefined();
    expect(document.state.global.memory).toHaveLength(0);
  });

  it("can be written while still a draft", () => {
    // Seeding before the walk starts is legitimate; only a finished queue
    // has no iteration left to carry a value into.
    const document = reducer(draft(), updateMemory({ key: "seed", value: 7 }));
    expect(document.state.global.memory).toEqual([{ key: "seed", value: 7 }]);
  });
});

describe("descriptions", () => {
  it("describes the queue, and clears the description", () => {
    let document = reducer(draft(), setDescription({ description: "Toggl" }));
    expect(document.state.global.description).toBe("Toggl");
    document = reducer(document, setDescription({}));
    expect(document.state.global.description).toBeNull();
  });

  it("describes a cursor in any status, and refuses an unknown one", () => {
    const live = running();
    const described = reducer(
      live,
      setCursorDescription({ id: "num", description: "Week of the year" }),
    );
    expect(described.state.global.cursors[0].description).toBe(
      "Week of the year",
    );

    const cleared = reducer(described, setCursorDescription({ id: "num" }));
    expect(cleared.state.global.cursors[0].description).toBeNull();

    expect(
      errorAt(reducer(live, setCursorDescription({ id: "ghost" })), 3),
    ).toContain("no cursor ghost");
  });
});
