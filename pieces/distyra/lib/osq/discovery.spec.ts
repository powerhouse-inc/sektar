/**
 * What a walk queues when it looks at a folder.
 *
 * The shapes are Dropbox's `files/list_folder` entries, dot-prefixed `.tag`
 * included — that leading dot is exactly the sort of thing a path helper
 * gets wrong.
 */
import { describe, expect, it } from "vitest";
import { discover, queueActions } from "./discovery.js";

function folder(path: string) {
  return { ".tag": "folder", name: path.split("/").pop(), path_lower: path };
}

function file(path: string) {
  return {
    ".tag": "file",
    name: path.split("/").pop(),
    id: `id:${path}`,
    path_lower: path,
    server_modified: "2026-09-22T11:02:00Z",
  };
}

const BASE = {
  valuePath: "path_lower",
  wherePath: ".tag",
  whereEquals: "folder",
  existing: [] as unknown[],
};

describe("what a listing contributes to the queue", () => {
  it("queues the subfolders and ignores the files", () => {
    const result = discover({
      ...BASE,
      records: [folder("/a"), file("/x.pdf"), folder("/b"), file("/y.png")],
    });
    expect(result.values).toEqual(["/a", "/b"]);
    expect(result.skipped).toBe(2);
  });

  it("reads a field whose name begins with a dot", () => {
    // `.tag` splits to ["", "tag"], so a naive path walker looks up "" first
    // and finds nothing — every folder would be skipped and the walk would
    // end after the root.
    const result = discover({ ...BASE, records: [folder("/a")] });
    expect(result.values).toEqual(["/a"]);
  });

  it("queues nothing twice across runs", () => {
    // The case that makes a walk non-terminating: a folder re-listed after a
    // failed run would queue its children again, and again.
    const result = discover({
      ...BASE,
      records: [folder("/a"), folder("/b")],
      existing: ["", "/a"],
    });
    expect(result.values).toEqual(["/b"]);
    expect(result.alreadyQueued).toBe(1);
  });

  it("queues nothing twice within one listing", () => {
    const result = discover({
      ...BASE,
      records: [folder("/a"), folder("/a")],
    });
    expect(result.values).toEqual(["/a"]);
    expect(result.alreadyQueued).toBe(1);
  });

  it("keeps everything when no filter is given", () => {
    const result = discover({
      valuePath: "path_lower",
      existing: [],
      records: [folder("/a"), file("/x.pdf")],
    });
    expect(result.values).toEqual(["/a", "/x.pdf"]);
  });

  it("skips a record missing the field entirely", () => {
    const result = discover({
      ...BASE,
      records: [{ ".tag": "folder" }, folder("/b")],
    });
    expect(result.values).toEqual(["/b"]);
    expect(result.skipped).toBe(1);
  });

  it("finds nothing in an empty folder", () => {
    const result = discover({ ...BASE, records: [] });
    expect(result.values).toEqual([]);
  });
});

describe("the actions sent to the queue", () => {
  it("records the discoveries, then advances", () => {
    // Order matters: advancing first would move the cursor before the
    // collection it walks had grown.
    const actions = queueActions("col-folders", ["/a", "/b"], true);
    expect(actions).toEqual([
      {
        type: "ADD_COLLECTION_VALUE",
        input: { collection: "col-folders", values: ["/a", "/b"] },
      },
      { type: "PROCEED", input: {} },
    ]);
  });

  it("advances alone from a leaf folder", () => {
    // ADD_COLLECTION_VALUE rejects an empty list, and a leaf discovers
    // nothing — so the push has to be absent, not empty.
    expect(queueActions("col-folders", [], true)).toEqual([
      { type: "PROCEED", input: {} },
    ]);
  });

  it("never emits an empty batch", () => {
    // A dispatch of zero actions is the other way a leaf could break the
    // walk; PROCEED is always there to carry it.
    for (const values of [[], ["/a"]]) {
      expect(queueActions("c", values, true).length).toBeGreaterThan(0);
    }
  });

  it("can record without advancing", () => {
    expect(queueActions("c", ["/a"], false)).toEqual([
      {
        type: "ADD_COLLECTION_VALUE",
        input: { collection: "c", values: ["/a"] },
      },
    ]);
  });
});
