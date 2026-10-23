/**
 * What the Files index writes, and which nodes a listing covers.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import { descendantsOf, scopeFor, searchWords, toListRow } from "./queries.js";
import { fileDocRow, globalOf, nodeRow, nodeRows, sameNode } from "./rows.js";

const AT = "2026-10-20T15:00:00.000Z";

describe("node rows from the drive's state", () => {
  const drive = {
    nodes: [
      { id: "f1", kind: "folder", name: "facturen", parentFolder: null },
      { id: "f2", kind: "folder", name: "2024", parentFolder: "f1" },
      { id: "d1", kind: "file", name: "Invoice (1).PDF", documentType: "sektar/file", parentFolder: "f2" },
      { id: "x", kind: "weird", name: "nope" },
      null,
      { kind: "file", name: "no id" },
    ],
  };

  it("keeps folders and files, with a lower-cased sort key and the parent", () => {
    const rows = nodeRows(drive);
    expect([...rows.keys()]).toEqual(["f1", "f2", "d1"]);
    expect(rows.get("d1")).toEqual({
      id: "d1",
      kind: "file",
      name: "Invoice (1).PDF",
      name_sort: "invoice (1).pdf",
      parent_id: "f2",
      document_type: "sektar/file",
    });
    expect(rows.get("f1")?.document_type).toBeNull();
    expect(rows.get("f1")?.parent_id).toBeNull();
    expect(nodeRows({})).toEqual(new Map());
  });

  it("compares rows by what a listing shows", () => {
    const a = nodeRow({ id: "a", kind: "file", name: "x", parentFolder: "p", documentType: "t" })!;
    expect(sameNode(a, { ...a })).toBe(true);
    expect(sameNode(a, { ...a, name: "y" })).toBe(false);
    expect(sameNode(a, { ...a, parent_id: null })).toBe(false);
  });

  it("reads the global state out of a resulting state, wrapped or bare", () => {
    expect(globalOf(JSON.stringify({ global: { nodes: [] }, header: {} }))).toEqual({ nodes: [] });
    expect(globalOf(JSON.stringify({ nodes: [] }))).toEqual({ nodes: [] });
    expect(globalOf("not json")).toBeNull();
    expect(globalOf(undefined)).toBeNull();
    expect(globalOf("3")).toBeNull();
  });
});

describe("a File's row", () => {
  it("carries what a listing shows and a thumbnail when there is an image", () => {
    const row = fileDocRow(
      "d1",
      {
        title: "Q2 return",
        description: "Filed on time",
        tags: [{ id: "t1", label: "Tax", color: "forest" }, { id: "", label: "drop" }],
        source: { kind: "ATTACHMENT", ref: "attachment://v1:aa", fileName: "q2.pdf", mimeType: "application/pdf", sizeBytes: 1200 },
        renditions: [
          { id: "r1", ref: "attachment://v1:bb", mimeType: "image/png", type: "preview", label: "Page 1" },
          { id: "r2", text: "hello", mimeType: "text/plain", type: "ocr" },
        ],
      },
      AT,
    );
    expect(row).toMatchObject({
      document_id: "d1",
      title: "Q2 return",
      source_kind: "ATTACHMENT",
      source_mime: "application/pdf",
      source_name: "q2.pdf",
      source_size: 1200,
      rendition_count: 2,
      thumb_ref: "attachment://v1:bb",
      updated_at: AT,
    });
    expect(JSON.parse(row.tags)).toEqual([{ id: "t1", label: "Tax", color: "forest" }]);
    expect(row.search_text).toContain("q2 return");
    expect(row.search_text).toContain("tax");
    expect(row.search_text).toContain("page 1");
  });

  it("uses an image source as its own thumbnail, and nothing for a linked document", () => {
    expect(
      fileDocRow("d", { source: { kind: "ATTACHMENT", ref: "attachment://v1:cc", mimeType: "image/jpeg" } }, AT).thumb_ref,
    ).toBe("attachment://v1:cc");
    const linked = fileDocRow(
      "d",
      { source: { kind: "DOCUMENT", documentId: "inv", documentType: "sektar/invoice", documentName: "BILL-1" } },
      AT,
    );
    expect(linked).toMatchObject({ source_kind: "DOCUMENT", source_document_type: "sektar/invoice", thumb_ref: null });
    expect(fileDocRow("d", {}, AT)).toMatchObject({ title: null, source_kind: null, rendition_count: 0, tags: "[]" });
  });
});

describe("what a listing covers", () => {
  const folders = [
    { id: "a", parent_id: null },
    { id: "b", parent_id: "a" },
    { id: "c", parent_id: "b" },
    { id: "z", parent_id: null },
  ];

  it("finds every folder below one, and below the root", () => {
    expect(descendantsOf(folders, "a")).toEqual(["b", "c"]);
    expect(descendantsOf(folders, null).sort()).toEqual(["a", "b", "c", "z"]);
    expect(descendantsOf(folders, "c")).toEqual([]);
  });

  it("scopes a folder, the root, and their deep variants", () => {
    expect(scopeFor(folders, "a", false)).toEqual({ parents: ["a"], root: false });
    expect(scopeFor(folders, null, false)).toEqual({ parents: [], root: true });
    expect(scopeFor(folders, null, true)).toEqual({ all: true });
    expect(scopeFor(folders, "a", true)).toEqual({ parents: ["a", "b", "c"], root: false });
  });

  it("turns a joined row into the listing's vocabulary", () => {
    expect(
      toListRow({
        id: "d1", kind: "file", name: "q2.pdf", parent_id: "a", document_type: "sektar/file",
        title: null, description: null, tags: "[{\"id\":\"t\",\"label\":\"Tax\",\"color\":\"mint\"}]",
        source_kind: "ATTACHMENT", source_mime: "application/pdf", source_name: "q2.pdf", source_size: "1200",
        source_document_type: null, source_document_name: null, rendition_count: "3", thumb_ref: null, disk_change: "UPDATE",
      }),
    ).toMatchObject({ kind: "file", sourceSize: 1200, renditionCount: 3, tags: [{ label: "Tax" }], diskChange: "UPDATE" });
    expect(
      toListRow({
        id: "f", kind: "folder", name: "x", parent_id: null, document_type: null, title: null, description: null,
        tags: "oops", source_kind: null, source_mime: null, source_name: null, source_size: null,
        source_document_type: null, source_document_name: null, rendition_count: null, thumb_ref: null, disk_change: null,
      }),
    ).toMatchObject({ kind: "folder", tags: [], renditionCount: 0, sourceSize: null, diskChange: null });
  });

  it("records a change waiting on disk, and none when there is none", () => {
    expect(fileDocRow("d", { placeholder: { change: "DELETE", target: "FILE" } }, AT).disk_change).toBe("DELETE");
    expect(fileDocRow("d", { source: { kind: "FILE_PLACEHOLDER" }, placeholder: { change: "CREATE" } }, AT)).toMatchObject({ source_kind: "FILE_PLACEHOLDER", disk_change: "CREATE" });
    expect(fileDocRow("d", { placeholder: null }, AT).disk_change).toBeNull();
    expect(fileDocRow("d", {}, AT).disk_change).toBeNull();
  });

  it("splits a search into a few words", () => {
    expect(searchWords("  Factuur  2024 ")).toEqual(["factuur", "2024"]);
    expect(searchWords(undefined)).toEqual([]);
  });
});
