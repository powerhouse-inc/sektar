/**
 * Which sources count as new.
 *
 * Getting this wrong is expensive in both directions: too eager and a flow
 * reprocesses work it already did, too shy and a capture is never handed on
 * at all. Neither announces itself.
 */
import { describe, expect, it } from "vitest";
import { sourcesAfter } from "./on-new-source.js";

interface S {
  id: string;
  externalId: string;
  aliases: string[];
  status: string;
  tags: string[];
  attachments: unknown[];
  capturedAt: string;
  lastSeenAt: string;
  mergedInto?: string | null;
}

function src(id: string, capturedAt: string, over: Partial<S> = {}): S {
  return {
    id,
    externalId: `gmail:${id}`,
    aliases: [],
    status: "NEW",
    tags: [],
    attachments: [],
    capturedAt,
    lastSeenAt: capturedAt,
    mergedInto: null,
    ...over,
  };
}

const ids = (list: { id: string }[]) => list.map((s) => s.id);

describe("what the trigger hands on", () => {
  const sources = [
    src("c", "2024-03-01T00:00:00.000Z"),
    src("a", "2024-01-01T00:00:00.000Z"),
    src("b", "2024-02-01T00:00:00.000Z"),
  ];

  it("hands on everything when nothing has been seen yet", () => {
    expect(ids(sourcesAfter(sources, null))).toEqual(["a", "b", "c"]);
  });

  it("hands them on oldest first", () => {
    // A backfill processed newest-first would build its downstream state in
    // the wrong order, which is the sort of thing nobody notices for a week.
    expect(ids(sourcesAfter(sources, null))).toEqual(["a", "b", "c"]);
  });

  it("skips anything already past the watermark", () => {
    expect(ids(sourcesAfter(sources, "2024-01-01T00:00:00.000Z"))).toEqual([
      "b",
      "c",
    ]);
  });

  it("hands on nothing when it is caught up", () => {
    expect(sourcesAfter(sources, "2024-03-01T00:00:00.000Z")).toEqual([]);
  });

  it("does not re-hand a source just because it was seen again", () => {
    // The reason the watermark tracks capturedAt and not lastSeenAt. A
    // re-capture pushes lastSeenAt forward; ordering on it would hand the
    // same record to the flow every time the backfill re-ran.
    const reSighted = [
      src("old", "2024-01-01T00:00:00.000Z", {
        lastSeenAt: "2024-09-01T00:00:00.000Z",
      }),
    ];
    expect(sourcesAfter(reSighted, "2024-02-01T00:00:00.000Z")).toEqual([]);
  });

  it("skips a folded source", () => {
    // Not new work: a record that two captures turned out to be one object.
    const withFold = [
      src("winner", "2024-01-01T00:00:00.000Z"),
      src("loser", "2024-02-01T00:00:00.000Z", {
        mergedInto: "winner",
        status: "DISCARDED",
      }),
    ];
    expect(ids(sourcesAfter(withFold, null))).toEqual(["winner"]);
  });

  it("copes with a collection holding nothing", () => {
    expect(sourcesAfter([], null)).toEqual([]);
    expect(sourcesAfter([], "2024-01-01T00:00:00.000Z")).toEqual([]);
  });
});
