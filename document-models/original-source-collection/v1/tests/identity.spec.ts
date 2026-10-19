/**
 * The identity core, on its own.
 *
 * Getting this wrong is quiet in the worst way: two unrelated objects become
 * one, or one object becomes two, and every count downstream is confidently
 * wrong. So these test the rules directly, before any document is involved.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import {
  claimantOf,
  claimantsOf,
  conflictingIdentifiers,
  identifiersOf,
  identifiersToAbsorb,
  identifiersToReturn,
  isMerged,
  isNamespaced,
  liveSource,
  pickWinner,
  union,
  type Identified,
} from "../src/identity.js";

function src(over: Partial<Identified> & { id: string }): Identified {
  return {
    externalId: `gmail:${over.id}`,
    aliases: [],
    capturedAt: "2024-01-01T00:00:00.000Z",
    mergedInto: null,
    ...over,
  };
}

describe("identifiers must name their system", () => {
  it("accepts a namespaced identifier", () => {
    expect(isNamespaced("gmail:18f3a")).toBe(true);
    expect(isNamespaced("sha256:9de1")).toBe(true);
    expect(isNamespaced("toggl-v9:42")).toBe(true);
  });

  it("rejects a bare one", () => {
    // The whole reason: "abc123" from Gmail and "abc123" from Toggl would be
    // the same key, and two unrelated objects would silently become one.
    expect(isNamespaced("abc123")).toBe(false);
    expect(isNamespaced("")).toBe(false);
    expect(isNamespaced(":")).toBe(false);
    expect(isNamespaced(":novalue")).toBe(false);
    expect(isNamespaced("nosystem:")).toBe(false);
  });
});

describe("following a tombstone", () => {
  it("sends a lookup on to the source that is actually live", () => {
    const sources = [
      src({ id: "a", mergedInto: "b" }),
      src({ id: "b" }),
    ];
    expect(liveSource(sources, sources[0]).id).toBe("b");
  });

  it("walks a merge of a merge", () => {
    // A workflow will eventually fold something into something already
    // folded; one hop is not enough.
    const sources = [
      src({ id: "a", mergedInto: "b" }),
      src({ id: "b", mergedInto: "c" }),
      src({ id: "c" }),
    ];
    expect(liveSource(sources, sources[0]).id).toBe("c");
  });

  it("stops on a cycle instead of hanging", () => {
    // A cycle is a bug elsewhere. Hanging would hide it; stopping surfaces it.
    const sources = [
      src({ id: "a", mergedInto: "b" }),
      src({ id: "b", mergedInto: "a" }),
    ];
    expect(() => liveSource(sources, sources[0])).not.toThrow();
    expect(["a", "b"]).toContain(liveSource(sources, sources[0]).id);
  });

  it("stops when the tombstone points at nothing", () => {
    const sources = [src({ id: "a", mergedInto: "gone" })];
    expect(liveSource(sources, sources[0]).id).toBe("a");
  });
});

describe("resolving an identifier to a source", () => {
  const sources = [
    src({ id: "a", externalId: "gmail:1", aliases: ["sha256:x"] }),
    src({ id: "b", externalId: "toggl:2" }),
  ];

  it("finds a source by its canonical id or by an alias", () => {
    expect(claimantOf(sources, "gmail:1")?.id).toBe("a");
    expect(claimantOf(sources, "sha256:x")?.id).toBe("a");
    expect(claimantOf(sources, "toggl:2")?.id).toBe("b");
  });

  it("finds nothing for an identifier nobody claims", () => {
    expect(claimantOf(sources, "gmail:999")).toBeUndefined();
  });

  it("resolves an old identifier to whatever absorbed it", () => {
    // A capture arriving under a folded source's id must land on the winner,
    // not resurrect the tombstone.
    const merged = [
      src({ id: "a", externalId: "gmail:1", mergedInto: "b" }),
      src({ id: "b", externalId: "toggl:2" }),
    ];
    expect(claimantOf(merged, "gmail:1")?.id).toBe("b");
  });

  it("reports every distinct source a set of identifiers reaches", () => {
    const reached = claimantsOf(sources, ["gmail:1", "toggl:2"]);
    expect(reached.map((s) => s.id).sort()).toEqual(["a", "b"]);
  });

  it("counts a source once even when several identifiers hit it", () => {
    expect(claimantsOf(sources, ["gmail:1", "sha256:x"])).toHaveLength(1);
  });
});

describe("choosing a winner", () => {
  it("keeps the earliest sighting", () => {
    const winner = pickWinner([
      src({ id: "late", capturedAt: "2024-06-01T00:00:00.000Z" }),
      src({ id: "early", capturedAt: "2024-01-01T00:00:00.000Z" }),
    ]);
    expect(winner.id).toBe("early");
  });

  it("breaks a tie the same way every time", () => {
    // Arbitrary is fine; unstable is not. A reducer must give the same answer
    // on every replay, so a tie cannot mean "whichever came back first".
    const a = src({ id: "bbb" });
    const b = src({ id: "aaa" });
    expect(pickWinner([a, b]).id).toBe("aaa");
    expect(pickWinner([b, a]).id).toBe("aaa");
  });
});

describe("moving identifiers on a merge", () => {
  const winner = src({ id: "w", externalId: "gmail:1", aliases: ["shared:x"] });
  const loser = src({ id: "l", externalId: "toggl:2", aliases: ["shared:x"] });

  it("absorbs only what the winner does not already hold", () => {
    expect(identifiersToAbsorb(winner, loser)).toEqual(["toggl:2"]);
  });

  it("gives back what the loser brought, on a split", () => {
    const merged = { ...loser, mergedInto: "w" };
    const after = {
      ...winner,
      aliases: union(winner.aliases, ["toggl:2"]),
    };
    expect(identifiersToReturn([after, merged], after, merged)).toEqual([
      "toggl:2",
      "shared:x",
    ]);
  });

  it("keeps an identifier another merged source still depends on", () => {
    // Undoing one merge must not quietly break a different one.
    const other = src({ id: "o", externalId: "shared:x", mergedInto: "w" });
    const merged = { ...loser, mergedInto: "w" };
    const after = { ...winner, aliases: ["shared:x", "toggl:2"] };
    expect(identifiersToReturn([after, merged, other], after, merged)).toEqual([
      "toggl:2",
    ]);
  });

  it("never gives back the winner's own canonical id", () => {
    const clash = src({ id: "l2", externalId: "gmail:1", mergedInto: "w" });
    expect(identifiersToReturn([winner, clash], winner, clash)).toEqual([]);
  });
});

describe("the invariant", () => {
  it("is satisfied when every identifier has one owner", () => {
    expect(
      conflictingIdentifiers([
        src({ id: "a", externalId: "gmail:1" }),
        src({ id: "b", externalId: "toggl:2" }),
      ]),
    ).toEqual([]);
  });

  it("names an identifier two live sources both claim", () => {
    expect(
      conflictingIdentifiers([
        src({ id: "a", externalId: "gmail:1" }),
        src({ id: "b", externalId: "toggl:2", aliases: ["gmail:1"] }),
      ]),
    ).toEqual(["gmail:1"]);
  });

  it("ignores a folded source, which is allowed to keep its identifiers", () => {
    // This is the point of not stripping a loser: it still answers to its own
    // ids, and that is not a conflict because it is no longer live.
    expect(
      conflictingIdentifiers([
        src({ id: "a", externalId: "gmail:1", mergedInto: "b" }),
        src({ id: "b", externalId: "toggl:2", aliases: ["gmail:1"] }),
      ]),
    ).toEqual([]);
  });
});

describe("sets held as arrays", () => {
  it("adds without duplicating, and keeps order", () => {
    expect(union(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("drops blanks and trims", () => {
    expect(union([], ["  x  ", "", "   "])).toEqual(["x"]);
  });

  it("reads a source's full identifier set", () => {
    expect(identifiersOf(src({ id: "a", aliases: ["x", "y"] }))).toEqual([
      "gmail:a",
      "x",
      "y",
    ]);
  });

  it("knows a tombstone from a live source", () => {
    expect(isMerged(src({ id: "a" }))).toBe(false);
    expect(isMerged(src({ id: "a", mergedInto: "b" }))).toBe(true);
    expect(isMerged(src({ id: "a", mergedInto: "" }))).toBe(false);
  });
});
