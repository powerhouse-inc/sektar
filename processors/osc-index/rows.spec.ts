/**
 * What the index says about a collection.
 *
 * A wrong row here is silent in the worst way: a lookup returns a plausible
 * document id, a capture lands in the wrong collection, and nothing errors.
 * So these test the mapping directly, without a database.
 */
import { describe, expect, it } from "vitest";
import { rowsFor } from "./processor.js";

interface Src {
  id: string;
  externalId: string;
  aliases: string[];
  status: string;
  title?: string | null;
  capturedAt: string;
  lastSeenAt: string;
  mergedInto?: string | null;
}

function src(over: Partial<Src> & { id: string; externalId: string }): Src {
  return {
    aliases: [],
    status: "NEW",
    title: null,
    capturedAt: "2024-01-01T00:00:00.000Z",
    lastSeenAt: "2024-01-01T00:00:00.000Z",
    mergedInto: null,
    ...over,
  };
}

const byId = <T extends { identifier: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => a.identifier.localeCompare(b.identifier));

describe("indexing a collection", () => {
  it("records every identifier a source answers to", () => {
    const rows = byId(
      rowsFor("doc-1", {
        title: "Gmail week 15",
        sources: [
          src({
            id: "s1",
            externalId: "gmail:1",
            aliases: ["sha256:9", "drive:7"],
            title: "Invoice",
          }),
        ],
      }),
    );

    expect(rows.map((r) => r.identifier)).toEqual([
      "drive:7",
      "gmail:1",
      "sha256:9",
    ]);
    // Every row names the document. That is the whole point of the index:
    // knowing something exists is only useful with somewhere to look.
    expect(rows.every((r) => r.document_id === "doc-1")).toBe(true);
    expect(rows.every((r) => r.source_id === "s1")).toBe(true);
    expect(rows.every((r) => r.collection_title === "Gmail week 15")).toBe(
      true,
    );
  });

  it("marks the canonical identifier apart from its aliases", () => {
    const rows = rowsFor("doc-1", {
      sources: [src({ id: "s1", externalId: "gmail:1", aliases: ["drive:7"] })],
    });
    expect(rows.find((r) => r.identifier === "gmail:1")?.is_alias).toBe(false);
    expect(rows.find((r) => r.identifier === "drive:7")?.is_alias).toBe(true);
  });

  it("points a folded source's identifiers at whatever absorbed it", () => {
    // The reason a lookup under an old id still works: it resolves to the
    // record that is actually current, not to a tombstone.
    const rows = rowsFor("doc-1", {
      sources: [
        src({ id: "winner", externalId: "gmail:1", title: "Kept" }),
        src({
          id: "loser",
          externalId: "toggl:2",
          status: "DISCARDED",
          mergedInto: "winner",
        }),
      ],
    });

    const folded = rows.find((r) => r.identifier === "toggl:2");
    expect(folded?.source_id).toBe("winner");
    expect(folded?.is_alias).toBe(true);
    // And it reports the winner's status, not the tombstone's.
    expect(folded?.status).toBe("NEW");
    expect(folded?.title).toBe("Kept");
  });

  it("follows a merge of a merge", () => {
    const rows = rowsFor("doc-1", {
      sources: [
        src({ id: "a", externalId: "gmail:1", mergedInto: "b" }),
        src({ id: "b", externalId: "toggl:2", mergedInto: "c" }),
        src({ id: "c", externalId: "sha256:3" }),
      ],
    });
    expect(rows.every((r) => r.source_id === "c")).toBe(true);
  });

  it("lets the live source keep an identifier a folded one also carries", () => {
    // Both claim shared:x. The row should describe the winner's own claim
    // rather than an inherited one, and there must be exactly one row.
    const rows = rowsFor("doc-1", {
      sources: [
        src({ id: "winner", externalId: "gmail:1", aliases: ["shared:x"] }),
        src({
          id: "loser",
          externalId: "shared:x",
          mergedInto: "winner",
          status: "DISCARDED",
        }),
      ],
    });
    const shared = rows.filter((r) => r.identifier === "shared:x");
    expect(shared).toHaveLength(1);
    expect(shared[0].source_id).toBe("winner");
    expect(shared[0].is_alias).toBe(true);
  });

  it("carries both timestamps, which answer different questions", () => {
    const rows = rowsFor("doc-1", {
      sources: [
        src({
          id: "s1",
          externalId: "gmail:1",
          capturedAt: "2024-01-01T00:00:00.000Z",
          lastSeenAt: "2024-06-01T00:00:00.000Z",
        }),
      ],
    });
    expect(rows[0].captured_at).toBe("2024-01-01T00:00:00.000Z");
    expect(rows[0].last_seen_at).toBe("2024-06-01T00:00:00.000Z");
  });

  it("indexes nothing for a collection it cannot read", () => {
    // Stale rows would send a capture at a collection that may be gone, so
    // an unreadable document contributes none.
    expect(rowsFor("doc-1", undefined)).toEqual([]);
    expect(rowsFor("doc-1", { sources: [] })).toEqual([]);
  });
});

describe("a collection large enough to break a single INSERT", () => {
  it("produces rows that must be written in batches", () => {
    // The real shape: a Dropbox walk reached 1,821 sources, each with its
    // canonical id and a path alias. At this table's nine columns that is
    // 32,778 bind parameters, and the driver gave up building the parameter
    // array long before PostgreSQL would have objected. The processor now
    // writes in batches; this records the size that forced it.
    const sources = Array.from({ length: 1821 }, (_, i) => ({
      id: `s-${String(i)}`,
      externalId: `dropbox:id-${String(i)}`,
      aliases: [`dropbox-path:/ksdc/f-${String(i)}.pdf`],
      status: "NEW",
      capturedAt: "2026-09-30T00:00:00.000Z",
      lastSeenAt: "2026-09-30T00:00:00.000Z",
      mergedInto: null,
    }));

    const rows = rowsFor("drop-1", { title: "Dropbox files", sources });
    expect(rows).toHaveLength(3642);

    const BATCH = 500;
    const batches: number[] = [];
    for (let at = 0; at < rows.length; at += BATCH) {
      batches.push(rows.slice(at, at + BATCH).length);
    }
    expect(batches).toEqual([500, 500, 500, 500, 500, 500, 500, 142]);
    // Every row reaches exactly one batch; a slice that lost or repeated
    // rows would leave the index quietly wrong rather than failing.
    expect(batches.reduce((a, b) => a + b, 0)).toBe(rows.length);
    // Comfortably inside PostgreSQL's 65,535 parameter ceiling.
    expect(BATCH * 9).toBeLessThan(65535);
  });
});
