/**
 * Classifying sources, raising work, and every refusal along the way.
 *
 * `capture-identity.test.ts` covers getting things in and working out what is
 * the same object. This covers what happens to them afterwards, and the
 * guards — a guard nobody has tripped is a guard nobody knows works.
 */
import {
  addSourceReference,
  assignTask,
  captureSource,
  createTask,
  discardSource,
  mergeSources,
  reducer,
  setDescription,
  setProvenance,
  setSourceStatus,
  setSourceTitle,
  setTaskDescription,
  setTaskStatus,
  setTitle,
  splitSource,
  tagSource,
  untagSource,
  utils,
  type OriginalSourceCollectionDocument,
} from "document-models/original-source-collection/v1";
import { describe, expect, it } from "vitest";

type Doc = OriginalSourceCollectionDocument;

function errorAt(document: Doc, index: number): string | undefined {
  return document.operations.global[index]?.error;
}

/** A collection holding two captured sources. Operations 0 and 1. */
function withTwo(): Doc {
  let document = reducer(
    utils.createDocument(),
    captureSource({
      id: "a",
      externalId: "gmail:1",
      capturedAt: "2024-01-01T00:00:00.000Z",
    }),
  );
  return reducer(
    document,
    captureSource({
      id: "b",
      externalId: "gmail:2",
      capturedAt: "2024-01-02T00:00:00.000Z",
    }),
  );
}

function sourceOf(document: Doc, id: string) {
  return document.state.global.sources.find((s) => s.id === id);
}

describe("describing the collection", () => {
  it("sets and clears a title and a description", () => {
    // SET_TITLE, not SET_NAME: setName is a base action, and a model
    // operation of that name would silently override the document's rename.
    let document = reducer(utils.createDocument(), setTitle({ title: "Gmail 2019" }));
    expect(document.state.global.title).toBe("Gmail 2019");
    document = reducer(document, setTitle({}));
    expect(document.state.global.title).toBeNull();

    document = reducer(document, setDescription({ description: "Raw capture" }));
    expect(document.state.global.description).toBe("Raw capture");
    document = reducer(document, setDescription({}));
    expect(document.state.global.description).toBeNull();
  });

  it("records where the contents came from", () => {
    const document = reducer(
      utils.createDocument(),
      setProvenance({
        queue: "pe1dLMr8nJN627YMIbPLIzRmJPAqHmw3KKm5PKqJr0s",
        system: "gmail",
        detail: { query: "after:2019/01/01" },
      }),
    );
    // The queue link is what lets the pair be read together.
    expect(document.state.global.provenance?.queue).toBe(
      "pe1dLMr8nJN627YMIbPLIzRmJPAqHmw3KKm5PKqJr0s",
    );
    expect(document.state.global.provenance?.detail).toEqual({
      query: "after:2019/01/01",
    });
  });

  it("accepts provenance with nothing filled in", () => {
    const document = reducer(utils.createDocument(), setProvenance({}));
    expect(document.state.global.provenance).toEqual({
      queue: null,
      system: null,
      detail: null,
    });
  });
});

describe("classifying a source", () => {
  it("titles one, and clears the title", () => {
    let document = reducer(
      withTwo(),
      setSourceTitle({ source: "a", title: "Invoice 42" }),
    );
    expect(sourceOf(document, "a")?.title).toBe("Invoice 42");
    document = reducer(document, setSourceTitle({ source: "a" }));
    expect(sourceOf(document, "a")?.title).toBeNull();
  });

  it("tags without duplicating, and untags", () => {
    let document = reducer(
      withTwo(),
      tagSource({ source: "a", tags: ["invoice", "paid"] }),
    );
    // A flow that re-runs should not have to check first.
    document = reducer(document, tagSource({ source: "a", tags: ["invoice"] }));
    expect(sourceOf(document, "a")?.tags).toEqual(["invoice", "paid"]);

    document = reducer(document, untagSource({ source: "a", tags: ["paid"] }));
    expect(sourceOf(document, "a")?.tags).toEqual(["invoice"]);
  });

  it("shrugs at untagging something that was never there", () => {
    const document = reducer(
      withTwo(),
      untagSource({ source: "a", tags: ["never"] }),
    );
    expect(errorAt(document, 2)).toBeUndefined();
    expect(sourceOf(document, "a")?.tags).toEqual([]);
  });

  it("moves a source through its statuses, and rolls the collection up", () => {
    let document = reducer(
      withTwo(),
      setSourceStatus({ source: "a", status: "PROCESSING" }),
    );
    expect(document.state.global.status).toBe("PROCESSING");
    expect(document.state.global.counts.processing).toBe(1);

    document = reducer(
      document,
      setSourceStatus({ source: "a", status: "COMPLETED" }),
    );
    document = reducer(document, discardSource({ source: "b" }));
    // Everything settled, so the collection is done with.
    expect(document.state.global.status).toBe("COMPLETED");
    expect(document.state.global.counts.completed).toBe(1);
    expect(document.state.global.counts.discarded).toBe(1);
  });

  it("will not restatus a source that was folded into another", () => {
    let document = reducer(
      withTwo(),
      mergeSources({
        keep: "a",
        merge: ["b"],
        mergedAt: "2024-02-01T00:00:00.000Z",
      }),
    );
    document = reducer(
      document,
      setSourceStatus({ source: "b", status: "NEW" }),
    );
    // Its DISCARDED status IS the record of the merge; changing it would
    // leave a source folded into another while claiming to be live.
    expect(errorAt(document, 3)).toContain("folded into");
    expect(sourceOf(document, "b")?.status).toBe("DISCARDED");
  });

  it("refuses every classification of a source that is not there", () => {
    const base = withTwo();
    const ghost = { source: "ghost" };
    expect(errorAt(reducer(base, setSourceTitle(ghost)), 2)).toContain(
      "no source ghost",
    );
    expect(
      errorAt(reducer(base, tagSource({ ...ghost, tags: ["x"] })), 2),
    ).toContain("no source ghost");
    expect(
      errorAt(reducer(base, untagSource({ ...ghost, tags: ["x"] })), 2),
    ).toContain("no source ghost");
    expect(
      errorAt(reducer(base, setSourceStatus({ ...ghost, status: "NEW" })), 2),
    ).toContain("no source ghost");
    expect(errorAt(reducer(base, discardSource(ghost)), 2)).toContain(
      "no source ghost",
    );
    expect(
      errorAt(
        reducer(base, addSourceReference({ ...ghost, reference: "https://x" })),
        2,
      ),
    ).toContain("no source ghost");
  });

  it("adds a reference without duplicating it", () => {
    let document = reducer(
      withTwo(),
      addSourceReference({ source: "a", reference: "https://example.com/x" }),
    );
    document = reducer(
      document,
      addSourceReference({ source: "a", reference: "https://example.com/x" }),
    );
    expect(sourceOf(document, "a")?.references).toEqual([
      "https://example.com/x",
    ]);
  });
});

describe("merging by hand", () => {
  it("refuses to fold a source into itself", () => {
    const document = reducer(
      withTwo(),
      mergeSources({ keep: "a", merge: ["a"], mergedAt: "2024-02-01T00:00:00.000Z" }),
    );
    expect(errorAt(document, 2)).toContain("into itself");
  });

  it("refuses when either side does not exist", () => {
    const base = withTwo();
    expect(
      errorAt(
        reducer(
          base,
          mergeSources({
            keep: "ghost",
            merge: ["a"],
            mergedAt: "2024-02-01T00:00:00.000Z",
          }),
        ),
        2,
      ),
    ).toContain("no source ghost to keep");
    expect(
      errorAt(
        reducer(
          base,
          mergeSources({
            keep: "a",
            merge: ["ghost"],
            mergedAt: "2024-02-01T00:00:00.000Z",
          }),
        ),
        2,
      ),
    ).toContain("no source ghost");
  });

  it("refuses to fold something already folded", () => {
    let document = reducer(
      withTwo(),
      mergeSources({ keep: "a", merge: ["b"], mergedAt: "2024-02-01T00:00:00.000Z" }),
    );
    document = reducer(
      document,
      mergeSources({ keep: "a", merge: ["b"], mergedAt: "2024-03-01T00:00:00.000Z" }),
    );
    expect(errorAt(document, 3)).toContain("already folded");
  });

  it("writes nothing when one of several targets is bad", () => {
    // Validated before anything is written: a half-applied merge would leave
    // some sources folded and others not, with no record of which.
    let document = reducer(
      withTwo(),
      captureSource({
        id: "c",
        externalId: "gmail:3",
        capturedAt: "2024-01-03T00:00:00.000Z",
      }),
    );
    document = reducer(
      document,
      mergeSources({
        keep: "a",
        merge: ["b", "ghost"],
        mergedAt: "2024-02-01T00:00:00.000Z",
      }),
    );
    expect(errorAt(document, 3)).toContain("no source ghost");
    expect(sourceOf(document, "b")?.mergedInto).toBeNull();
    expect(sourceOf(document, "a")?.aliases).toEqual([]);
  });

  it("refuses to split a source that is not there", () => {
    expect(errorAt(reducer(withTwo(), splitSource({ source: "ghost" })), 2)).toContain(
      "no source ghost",
    );
  });
});

describe("tasks", () => {
  it("raises one about a source, and one about the batch", () => {
    let document = reducer(
      withTwo(),
      createTask({
        id: "t1",
        description: "Check the total",
        source: "a",
        createdAt: "2024-02-01T00:00:00.000Z",
      }),
    );
    document = reducer(
      document,
      createTask({
        id: "t2",
        description: "Reconcile the month",
        owner: "wouter",
        createdAt: "2024-02-01T00:00:00.000Z",
      }),
    );

    expect(document.state.global.tasks).toHaveLength(2);
    // Defaults to TODO: a task raised by a flow is work, not a draft.
    expect(document.state.global.tasks[0].status).toBe("TODO");
    expect(document.state.global.tasks[1].source).toBeNull();
    expect(document.state.global.counts.openTasks).toBe(2);
  });

  it("honours an explicit starting status", () => {
    const document = reducer(
      withTwo(),
      createTask({
        id: "t1",
        status: "DRAFT",
        createdAt: "2024-02-01T00:00:00.000Z",
      }),
    );
    expect(document.state.global.tasks[0].status).toBe("DRAFT");
  });

  it("stops counting a task once it is done or cancelled", () => {
    let document = reducer(
      withTwo(),
      createTask({ id: "t1", createdAt: "2024-02-01T00:00:00.000Z" }),
    );
    document = reducer(
      document,
      createTask({ id: "t2", createdAt: "2024-02-01T00:00:00.000Z" }),
    );
    expect(document.state.global.counts.openTasks).toBe(2);

    document = reducer(document, setTaskStatus({ task: "t1", status: "DONE" }));
    document = reducer(
      document,
      setTaskStatus({ task: "t2", status: "CANCELLED" }),
    );
    // Cancelled is a tombstone, not a deletion: the task is still there.
    expect(document.state.global.counts.openTasks).toBe(0);
    expect(document.state.global.tasks).toHaveLength(2);
  });

  it("assigns and unassigns, describes and undescribes", () => {
    let document = reducer(
      withTwo(),
      createTask({ id: "t1", createdAt: "2024-02-01T00:00:00.000Z" }),
    );
    document = reducer(document, assignTask({ task: "t1", owner: "wouter" }));
    expect(document.state.global.tasks[0].owner).toBe("wouter");
    document = reducer(document, assignTask({ task: "t1" }));
    expect(document.state.global.tasks[0].owner).toBeNull();

    document = reducer(
      document,
      setTaskDescription({ task: "t1", description: "Look again" }),
    );
    expect(document.state.global.tasks[0].description).toBe("Look again");
    document = reducer(document, setTaskDescription({ task: "t1" }));
    expect(document.state.global.tasks[0].description).toBeNull();
  });

  it("refuses a duplicate id and a source that does not exist", () => {
    let document = reducer(
      withTwo(),
      createTask({ id: "t1", createdAt: "2024-02-01T00:00:00.000Z" }),
    );
    document = reducer(
      document,
      createTask({ id: "t1", createdAt: "2024-02-01T00:00:00.000Z" }),
    );
    expect(errorAt(document, 3)).toContain("already exists");

    document = reducer(
      document,
      createTask({
        id: "t2",
        source: "ghost",
        createdAt: "2024-02-01T00:00:00.000Z",
      }),
    );
    expect(errorAt(document, 4)).toContain("does not exist");
  });

  it("refuses to touch a task that is not there", () => {
    const base = withTwo();
    expect(
      errorAt(reducer(base, setTaskStatus({ task: "ghost", status: "DONE" })), 2),
    ).toContain("no task ghost");
    expect(errorAt(reducer(base, assignTask({ task: "ghost" })), 2)).toContain(
      "no task ghost",
    );
    expect(
      errorAt(reducer(base, setTaskDescription({ task: "ghost" })), 2),
    ).toContain("no task ghost");
  });
});

describe("capture updating an existing source", () => {
  const ref = "attachment://v1:aaaa1111";

  it("overwrites each provided field and dedupes attachments", () => {
    let document = reducer(
      utils.createDocument(),
      captureSource({
        id: "a",
        externalId: "gmail:1",
        attachments: [{ ref, fileName: "one.pdf" }],
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    document = reducer(
      document,
      captureSource({
        id: "a2",
        externalId: "gmail:1",
        title: "Now titled",
        origin: "https://example.com/here",
        content: "now has a body",
        payload: { v: 2 },
        occurredAt: "2023-12-25T00:00:00.000Z",
        // Same bytes: content-addressed, so it must not be listed twice.
        attachments: [
          { ref, fileName: "one.pdf" },
          { ref: "attachment://v1:bbbb2222", fileName: "two.pdf" },
        ],
        capturedAt: "2024-02-01T00:00:00.000Z",
      }),
    );

    const source = document.state.global.sources[0];
    expect(source.title).toBe("Now titled");
    expect(source.origin).toBe("https://example.com/here");
    expect(source.content).toBe("now has a body");
    expect(source.payload).toEqual({ v: 2 });
    expect(source.occurredAt).toBe("2023-12-25T00:00:00.000Z");
    expect(source.attachments).toHaveLength(2);
  });
});
