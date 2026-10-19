/**
 * Capture and identity, through the real reducers.
 *
 * The centrepiece is the permutation test: three sightings of one object,
 * applied in all six orders, must always end as one source answering to all
 * three identifiers. Order-independence is the entire claim of resolving by
 * identifier rather than by position, and six orders prove it where one
 * sample would only fail to disprove it.
 *
 * Errors are asserted through `operations.global[i].error`, never
 * `.toThrow()` — a throwing reducer still records its operation.
 */
import {
  addAlias,
  attachToSource,
  captureSource,
  detachFromSource,
  discardCollection,
  mergeSources,
  reducer,
  removeAlias,
  restoreCollection,
  splitSource,
  tagSource,
  utils,
  type OriginalSourceCollectionDocument,
} from "document-models/original-source-collection/v1";
import { describe, expect, it } from "vitest";
import { conflictingIdentifiers } from "../src/identity.js";

type Doc = OriginalSourceCollectionDocument;

function errorAt(document: Doc, index: number): string | undefined {
  return document.operations.global[index]?.error;
}

/** Live sources — the ones not folded into something else. */
function live(document: Doc) {
  return document.state.global.sources.filter((s) => !s.mergedInto);
}

/** Every identifier a source answers to. */
function ids(source: { externalId: string; aliases: string[] }) {
  return [source.externalId, ...source.aliases].sort();
}

/** The invariant, as an assertion. Nothing may ever break it. */
function expectNoConflicts(document: Doc) {
  expect(conflictingIdentifiers(document.state.global.sources)).toEqual([]);
}

interface Sighting {
  id: string;
  externalId: string;
  aliases?: string[];
  capturedAt: string;
}

function applyAll(sightings: Sighting[]): Doc {
  let document = utils.createDocument();
  for (const sighting of sightings) {
    document = reducer(
      document,
      captureSource({
        id: sighting.id,
        externalId: sighting.externalId,
        aliases: sighting.aliases ?? [],
        capturedAt: sighting.capturedAt,
      }),
    );
  }
  return document;
}

/** Every ordering of a list. */
function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations([
      ...items.slice(0, index),
      ...items.slice(index + 1),
    ]).map((rest) => [item, ...rest]),
  );
}

describe("resolving one object seen three ways", () => {
  // Each sighting overlaps the previous one, which is what links them: a
  // record arriving under two identifiers is the evidence that they name the
  // same thing.
  const sightings: Sighting[] = [
    { id: "s1", externalId: "gmail:1", capturedAt: "2024-01-01T00:00:00.000Z" },
    {
      id: "s2",
      externalId: "sha256:2",
      aliases: ["gmail:1"],
      capturedAt: "2024-01-02T00:00:00.000Z",
    },
    {
      id: "s3",
      externalId: "toggl:3",
      aliases: ["sha256:2"],
      capturedAt: "2024-01-03T00:00:00.000Z",
    },
  ];

  it("ends with one source answering to all three, in every order", () => {
    const orders = permutations(sightings);
    expect(orders).toHaveLength(6);

    for (const order of orders) {
      const document = applyAll(order);
      const survivors = live(document);
      const which = order.map((s) => s.externalId).join(" → ");

      expect(survivors, which).toHaveLength(1);
      expect(ids(survivors[0]), which).toEqual([
        "gmail:1",
        "sha256:2",
        "toggl:3",
      ]);
      expectNoConflicts(document);
    }
  });

  it("does not promise WHICH identifier ends up canonical", () => {
    // Deliberately not asserted above. The object is the same either way;
    // which sighting's id is canonical depends on which arrived first, and
    // pretending otherwise would be testing an accident.
    const first = live(applyAll(sightings))[0].externalId;
    const last = live(applyAll([...sightings].reverse()))[0].externalId;
    expect(first).not.toBe(last);
  });
});

describe("capturing the same thing twice", () => {
  it("updates rather than duplicating", () => {
    let document = reducer(
      utils.createDocument(),
      captureSource({
        id: "a",
        externalId: "gmail:1",
        title: "First look",
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    document = reducer(
      document,
      captureSource({
        id: "b-unused",
        externalId: "gmail:1",
        title: "Second look",
        capturedAt: "2024-02-01T00:00:00.000Z",
      }),
    );

    // The safety property the whole backfill depends on.
    expect(document.state.global.sources).toHaveLength(1);
    expect(document.state.global.sources[0].title).toBe("Second look");
    // The second sighting moves lastSeenAt, not capturedAt.
    expect(document.state.global.sources[0].lastSeenAt).toBe(
      "2024-02-01T00:00:00.000Z",
    );
  });

  it("adds to sets and never empties them", () => {
    let document = reducer(
      utils.createDocument(),
      captureSource({
        id: "a",
        externalId: "gmail:1",
        tags: ["invoice"],
        references: ["https://example.com/a"],
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    // A later sighting that happens to omit a tag is not a decision to
    // remove it — only UNTAG_SOURCE means that.
    document = reducer(
      document,
      captureSource({
        id: "a2",
        externalId: "gmail:1",
        tags: ["paid"],
        capturedAt: "2024-02-01T00:00:00.000Z",
      }),
    );

    const source = document.state.global.sources[0];
    expect(source.tags.sort()).toEqual(["invoice", "paid"]);
    expect(source.references).toEqual(["https://example.com/a"]);
  });

  it("leaves absent fields alone rather than blanking them", () => {
    let document = reducer(
      utils.createDocument(),
      captureSource({
        id: "a",
        externalId: "gmail:1",
        title: "Known",
        content: "body",
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    document = reducer(
      document,
      captureSource({
        id: "a2",
        externalId: "gmail:1",
        capturedAt: "2024-02-01T00:00:00.000Z",
      }),
    );
    expect(document.state.global.sources[0].title).toBe("Known");
    expect(document.state.global.sources[0].content).toBe("body");
  });

  it("remembers when it first arrived, separately from when it was last seen", () => {
    let document = reducer(
      utils.createDocument(),
      captureSource({
        id: "a",
        externalId: "gmail:1",
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    document = reducer(
      document,
      captureSource({
        id: "a2",
        externalId: "gmail:1",
        capturedAt: "2024-06-01T00:00:00.000Z",
      }),
    );
    const source = document.state.global.sources[0];
    expect(source.capturedAt).toBe("2024-01-01T00:00:00.000Z");
    expect(source.lastSeenAt).toBe("2024-06-01T00:00:00.000Z");
  });

  it("does not let a re-sighting cost a source a merge it should win", () => {
    // The reason capturedAt is frozen. `pickWinner` sorts on it, so if a
    // re-capture pushed it forward, a long-known source would start losing
    // merges to things first seen after it.
    let document = reducer(
      utils.createDocument(),
      captureSource({
        id: "old",
        externalId: "gmail:1",
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    document = reducer(
      document,
      captureSource({
        id: "newer",
        externalId: "toggl:2",
        capturedAt: "2024-03-01T00:00:00.000Z",
      }),
    );
    // The old one is seen again, after the newer one first appeared.
    document = reducer(
      document,
      captureSource({
        id: "ignored",
        externalId: "gmail:1",
        capturedAt: "2024-09-01T00:00:00.000Z",
      }),
    );
    // Now something links them.
    document = reducer(
      document,
      captureSource({
        id: "link",
        externalId: "gmail:1",
        aliases: ["toggl:2"],
        capturedAt: "2024-10-01T00:00:00.000Z",
      }),
    );

    expect(live(document)).toHaveLength(1);
    expect(live(document)[0].id).toBe("old");
  });

  it("keeps the payload exactly as it arrived", () => {
    const payload = { id: 1, nested: { list: [1, 2], flag: false } };
    const document = reducer(
      utils.createDocument(),
      captureSource({
        id: "a",
        externalId: "gmail:1",
        payload,
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    expect(document.state.global.sources[0].payload).toEqual(payload);
  });
});

describe("auto-merge on capture", () => {
  function twoThenLink(): Doc {
    let document = applyAll([
      { id: "a", externalId: "gmail:1", capturedAt: "2024-01-01T00:00:00.000Z" },
      { id: "b", externalId: "toggl:2", capturedAt: "2024-02-01T00:00:00.000Z" },
    ]);
    // A record carrying both is the evidence that they are one object.
    return reducer(
      document,
      captureSource({
        id: "c",
        externalId: "gmail:1",
        aliases: ["toggl:2"],
        capturedAt: "2024-03-01T00:00:00.000Z",
      }),
    );
  }

  it("folds them together and keeps the earliest sighting", () => {
    const document = twoThenLink();
    expect(live(document)).toHaveLength(1);
    expect(live(document)[0].id).toBe("a");
    expect(ids(live(document)[0])).toEqual(["gmail:1", "toggl:2"]);
  });

  it("leaves a tombstone that names its winner, both ways", () => {
    // Auto-merge fuses records from a side effect, so it has to be legible
    // afterwards: this is what makes it auditable rather than silent.
    const document = twoThenLink();
    const loser = document.state.global.sources.find((s) => s.id === "b");
    expect(loser?.mergedInto).toBe("a");
    expect(loser?.status).toBe("DISCARDED");
    expect(loser?.mergedAt).toBe("2024-03-01T00:00:00.000Z");
    expect(live(document)[0].mergedFrom).toEqual(["b"]);
  });

  it("keeps the loser's own payload where it landed", () => {
    // Only identity moves. Destroying the folded record would defeat the
    // point of an original-source store.
    let document = reducer(
      utils.createDocument(),
      captureSource({
        id: "a",
        externalId: "gmail:1",
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    document = reducer(
      document,
      captureSource({
        id: "b",
        externalId: "toggl:2",
        payload: { from: "toggl" },
        capturedAt: "2024-02-01T00:00:00.000Z",
      }),
    );
    document = reducer(
      document,
      captureSource({
        id: "c",
        externalId: "gmail:1",
        aliases: ["toggl:2"],
        capturedAt: "2024-03-01T00:00:00.000Z",
      }),
    );
    const loser = document.state.global.sources.find((s) => s.id === "b");
    expect(loser?.payload).toEqual({ from: "toggl" });
  });

  it("lands a later capture under the old id on the winner", () => {
    let document = twoThenLink();
    document = reducer(
      document,
      captureSource({
        id: "d",
        externalId: "toggl:2",
        title: "Still findable",
        capturedAt: "2024-04-01T00:00:00.000Z",
      }),
    );
    expect(live(document)).toHaveLength(1);
    expect(live(document)[0].title).toBe("Still findable");
    expectNoConflicts(document);
  });

  it("counts what happened", () => {
    const counts = twoThenLink().state.global.counts;
    expect(counts.total).toBe(2);
    expect(counts.merged).toBe(1);
    expect(counts.discarded).toBe(1);
    expect(counts.new).toBe(1);
  });
});

describe("undoing a merge", () => {
  function merged(): Doc {
    const document = applyAll([
      { id: "a", externalId: "gmail:1", capturedAt: "2024-01-01T00:00:00.000Z" },
      { id: "b", externalId: "toggl:2", capturedAt: "2024-02-01T00:00:00.000Z" },
    ]);
    return reducer(
      document,
      mergeSources({
        keep: "a",
        merge: ["b"],
        mergedAt: "2024-03-01T00:00:00.000Z",
      }),
    );
  }

  it("returns both sources to standing on their own", () => {
    const document = reducer(merged(), splitSource({ source: "b" }));
    expect(live(document)).toHaveLength(2);
    const winner = document.state.global.sources.find((s) => s.id === "a");
    const freed = document.state.global.sources.find((s) => s.id === "b");
    // The winner gives back exactly what it took.
    expect(winner?.aliases).toEqual([]);
    expect(freed?.mergedInto).toBeNull();
    expect(freed?.status).toBe("NEW");
    expect(winner?.mergedFrom).toEqual([]);
    expectNoConflicts(document);
  });

  it("restores to a status the caller chooses", () => {
    const document = reducer(
      merged(),
      splitSource({ source: "b", status: "COMPLETED" }),
    );
    expect(
      document.state.global.sources.find((s) => s.id === "b")?.status,
    ).toBe("COMPLETED");
  });

  it("does not break a second merge into the same winner", () => {
    let document = applyAll([
      { id: "a", externalId: "gmail:1", capturedAt: "2024-01-01T00:00:00.000Z" },
      { id: "b", externalId: "toggl:2", capturedAt: "2024-02-01T00:00:00.000Z" },
      { id: "c", externalId: "sha256:3", capturedAt: "2024-03-01T00:00:00.000Z" },
    ]);
    document = reducer(
      document,
      mergeSources({
        keep: "a",
        merge: ["b", "c"],
        mergedAt: "2024-04-01T00:00:00.000Z",
      }),
    );
    document = reducer(document, splitSource({ source: "b" }));

    const winner = document.state.global.sources.find((s) => s.id === "a");
    // c is still folded in, so the winner must keep answering for it.
    expect(winner?.aliases).toEqual(["sha256:3"]);
    expect(winner?.mergedFrom).toEqual(["c"]);
    expectNoConflicts(document);
  });

  it("refuses to split something that stands on its own", () => {
    const document = reducer(
      applyAll([
        {
          id: "a",
          externalId: "gmail:1",
          capturedAt: "2024-01-01T00:00:00.000Z",
        },
      ]),
      splitSource({ source: "a" }),
    );
    expect(errorAt(document, 1)).toContain("no merge to undo");
  });
});

describe("aliases by hand", () => {
  function two(): Doc {
    return applyAll([
      { id: "a", externalId: "gmail:1", capturedAt: "2024-01-01T00:00:00.000Z" },
      { id: "b", externalId: "toggl:2", capturedAt: "2024-02-01T00:00:00.000Z" },
    ]);
  }

  it("adds one, and a later capture under it lands here", () => {
    let document = reducer(
      applyAll([
        {
          id: "a",
          externalId: "gmail:1",
          capturedAt: "2024-01-01T00:00:00.000Z",
        },
      ]),
      addAlias({ source: "a", alias: "sha256:9" }),
    );
    document = reducer(
      document,
      captureSource({
        id: "new",
        externalId: "sha256:9",
        capturedAt: "2024-02-01T00:00:00.000Z",
      }),
    );
    expect(document.state.global.sources).toHaveLength(1);
  });

  it("refuses an identifier another source already answers to", () => {
    // Unlike capture, this is somebody typing — not evidence — so it asks
    // them to mean it rather than fusing two records on a keystroke.
    const document = reducer(two(), addAlias({ source: "a", alias: "toggl:2" }));
    expect(errorAt(document, 2)).toContain("already answers to");
    expect(live(document)).toHaveLength(2);
  });

  it("refuses an alias with no system", () => {
    const document = reducer(two(), addAlias({ source: "a", alias: "abc123" }));
    expect(errorAt(document, 2)).toContain("does not name the system");
  });

  it("will not remove the canonical identifier", () => {
    const document = reducer(
      two(),
      removeAlias({ source: "a", alias: "gmail:1" }),
    );
    expect(errorAt(document, 2)).toContain("canonical externalId");
  });

  it("removes one it does hold, and refuses one it does not", () => {
    let document = reducer(two(), addAlias({ source: "a", alias: "sha256:9" }));
    document = reducer(
      document,
      removeAlias({ source: "a", alias: "sha256:9" }),
    );
    expect(document.state.global.sources[0].aliases).toEqual([]);

    document = reducer(document, removeAlias({ source: "a", alias: "x:1" }));
    expect(errorAt(document, 4)).toContain("does not answer to");
  });
});

describe("capture refuses what it should", () => {
  it("rejects an identifier with no system", () => {
    const document = reducer(
      utils.createDocument(),
      captureSource({
        id: "a",
        externalId: "abc123",
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    expect(errorAt(document, 0)).toContain("does not name the system");
    expect(document.state.global.sources).toHaveLength(0);
  });

  it("rejects an unnamespaced alias too", () => {
    const document = reducer(
      utils.createDocument(),
      captureSource({
        id: "a",
        externalId: "gmail:1",
        aliases: ["loose"],
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    expect(errorAt(document, 0)).toContain("does not name the system");
  });

  it("rejects a colliding OID when it would create a source", () => {
    let document = applyAll([
      { id: "a", externalId: "gmail:1", capturedAt: "2024-01-01T00:00:00.000Z" },
    ]);
    document = reducer(
      document,
      captureSource({
        id: "a",
        externalId: "toggl:2",
        capturedAt: "2024-02-01T00:00:00.000Z",
      }),
    );
    expect(errorAt(document, 1)).toContain("already taken");
  });

  it("refuses to add to an abandoned collection, and resumes once restored", () => {
    let document = reducer(utils.createDocument(), discardCollection({}));
    document = reducer(
      document,
      captureSource({
        id: "a",
        externalId: "gmail:1",
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    expect(errorAt(document, 1)).toContain("abandoned");

    document = reducer(document, restoreCollection({}));
    document = reducer(
      document,
      captureSource({
        id: "a",
        externalId: "gmail:1",
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    expect(document.state.global.sources).toHaveLength(1);
    expect(document.state.global.status).toBe("NEW");
  });
});

describe("attachments", () => {
  const ref = "attachment://v1:0650db71d59898645909bead884f73cc0940382b";

  function withSource(): Doc {
    return applyAll([
      { id: "a", externalId: "gmail:1", capturedAt: "2024-01-01T00:00:00.000Z" },
    ]);
  }

  it("takes refs inline on capture, as a flow already holds them", () => {
    // The Gmail piece writes files through context.files.write and gets back
    // exactly this shape, so a capture can carry them straight in.
    const document = reducer(
      utils.createDocument(),
      captureSource({
        id: "a",
        externalId: "gmail:1",
        attachments: [{ ref, fileName: "invoice.pdf", sizeBytes: 1024 }],
        capturedAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    const held = document.state.global.sources[0].attachments[0];
    expect(held.ref).toBe(ref);
    expect(held.fileName).toBe("invoice.pdf");
    // Not supplied by the source, so not invented.
    expect(held.mimeType).toBeNull();
  });

  it("attaches after the fact, and refuses the same bytes twice", () => {
    let document = reducer(
      withSource(),
      attachToSource({ source: "a", ref, fileName: "invoice.pdf" }),
    );
    expect(document.state.global.sources[0].attachments).toHaveLength(1);

    document = reducer(
      document,
      attachToSource({ source: "a", ref, fileName: "again.pdf" }),
    );
    expect(errorAt(document, 2)).toContain("already attached");
  });

  it("detaches a mis-attachment, and refuses one that is not there", () => {
    let document = reducer(
      withSource(),
      attachToSource({ source: "a", ref, fileName: "wrong.pdf" }),
    );
    document = reducer(document, detachFromSource({ source: "a", ref }));
    expect(document.state.global.sources[0].attachments).toHaveLength(0);

    document = reducer(document, detachFromSource({ source: "a", ref }));
    expect(errorAt(document, 3)).toContain("not attached");
  });
});

describe("the collection's own status", () => {
  it("rolls up from its sources", () => {
    let document = utils.createDocument();
    expect(document.state.global.status).toBe("NEW");

    document = applyAll([
      { id: "a", externalId: "gmail:1", capturedAt: "2024-01-01T00:00:00.000Z" },
      { id: "b", externalId: "gmail:2", capturedAt: "2024-01-02T00:00:00.000Z" },
    ]);
    expect(document.state.global.status).toBe("NEW");

    document = reducer(document, tagSource({ source: "a", tags: ["x"] }));
    // Tagging is not progress; only a status change is.
    expect(document.state.global.status).toBe("NEW");
  });

  it("stays abandoned once abandoned, whatever the sources say", () => {
    let document = applyAll([
      { id: "a", externalId: "gmail:1", capturedAt: "2024-01-01T00:00:00.000Z" },
    ]);
    document = reducer(document, discardCollection({}));
    expect(document.state.global.status).toBe("DISCARDED");

    // A roll-up would undo the decision on the next operation.
    document = reducer(document, tagSource({ source: "a", tags: ["x"] }));
    expect(document.state.global.status).toBe("DISCARDED");
  });

  it("refuses a second abandonment and a pointless restore", () => {
    let document = reducer(utils.createDocument(), discardCollection({}));
    expect(errorAt(reducer(document, discardCollection({})), 1)).toContain(
      "already been abandoned",
    );
    document = reducer(document, restoreCollection({}));
    expect(errorAt(reducer(document, restoreCollection({})), 2)).toContain(
      "is live",
    );
  });
});
