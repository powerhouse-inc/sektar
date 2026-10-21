import type { OperationWithContext } from "document-model";
import { describe, expect, it } from "vitest";
import { changedNodes, inScope, REPLAY_MARGIN_MS, type ScopeNode } from "./scope.js";

const TYPES = { file: "sektar/file", drive: "powerhouse/document-drive" };
const NOW = Date.parse("2026-10-21T18:00:00Z");

function op(documentType: string, documentId: string, input: unknown = {}, at = NOW, scope = "global"): OperationWithContext {
  return {
    operation: { index: 0, timestampUtcMs: new Date(at).toISOString(), hash: "", skip: 0, id: "x", action: { id: "a", type: "X", input, scope, timestampUtcMs: "" } },
    context: { documentId, documentType, scope, branch: "main", ordinal: 1 },
  } as unknown as OperationWithContext;
}

//   root ── q3 ── ap ── aws ── invoice
//        └─ q4 ── other
const NODES: ScopeNode[] = [
  { id: "q3", parentFolder: null },
  { id: "ap", parentFolder: "q3" },
  { id: "aws", parentFolder: "ap" },
  { id: "invoice", parentFolder: "aws" },
  { id: "q4", parentFolder: null },
  { id: "other", parentFolder: "q4" },
  { id: "top", parentFolder: null },
];

describe("the nodes a batch changed", () => {
  it("names changed Files and the nodes the drive's operations name", () => {
    const ids = changedNodes(
      [
        op(TYPES.file, "invoice"),
        op(TYPES.drive, "drive", { srcFolder: "aws", targetParentFolder: "q4" }),
        op(TYPES.drive, "drive", { id: "new", parentFolder: "ap" }),
        op(TYPES.drive, "drive", null),
      ],
      "drive",
      TYPES,
      NOW,
    );
    expect([...ids].sort()).toEqual(["ap", "aws", "invoice", "new", "q4"]);
  });

  it("leaves out other drives, other types, other scopes and a replay of old operations", () => {
    const ids = changedNodes(
      [
        op(TYPES.drive, "elsewhere", { id: "n" }),
        op("sektar/folder-sync", "mapping"),
        op(TYPES.file, "local-only", {}, NOW, "local"),
        op(TYPES.file, "old", {}, NOW - REPLAY_MARGIN_MS - 1),
        op(TYPES.file, "recent", {}, NOW - REPLAY_MARGIN_MS + 1),
      ],
      "drive",
      TYPES,
      NOW,
    );
    expect([...ids]).toEqual(["recent"]);
  });
});

describe("whether a change concerns a mapping", () => {
  const q3 = { folderId: "q3", includeSubfolders: true };

  it("counts a change anywhere below the mapped folder, and the folder itself", () => {
    expect(inScope(new Set(["invoice"]), NODES, q3)).toBe(true);
    expect(inScope(new Set(["q3"]), NODES, q3)).toBe(true);
  });

  it("does not count a change elsewhere in the drive, or no change at all", () => {
    expect(inScope(new Set(["other", "top", "q4"]), NODES, q3)).toBe(false);
    expect(inScope(new Set(), NODES, q3)).toBe(false);
  });

  it("counts a node the drive no longer knows (a deletion)", () => {
    expect(inScope(new Set(["gone"]), NODES, q3)).toBe(true);
  });

  it("without subfolders, counts the folder's own children only", () => {
    const flat = { folderId: "q3", includeSubfolders: false };
    expect(inScope(new Set(["ap"]), NODES, flat)).toBe(true);
    expect(inScope(new Set(["invoice"]), NODES, flat)).toBe(false);
  });

  it("a mapping of the whole drive counts everything; of the root alone, the root's children", () => {
    expect(inScope(new Set(["other"]), NODES, { folderId: null, includeSubfolders: true })).toBe(true);
    const rootOnly = { folderId: null, includeSubfolders: false };
    expect(inScope(new Set(["top"]), NODES, rootOnly)).toBe(true);
    expect(inScope(new Set(["invoice"]), NODES, rootOnly)).toBe(false);
  });

  it("a node moved out of the folder is in scope by the tree from before the move", () => {
    const after = NODES.map((n) => (n.id === "aws" ? { ...n, parentFolder: "q4" } : n));
    const moved = new Set(["aws", "q4"]);
    expect(inScope(moved, after, q3)).toBe(false);
    expect(inScope(moved, NODES, q3)).toBe(true);
  });

  it("survives a folder loop", () => {
    const loop: ScopeNode[] = [
      { id: "a", parentFolder: "b" },
      { id: "b", parentFolder: "a" },
    ];
    expect(inScope(new Set(["a"]), loop, q3)).toBe(false);
  });
});
