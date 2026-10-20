/**
 * What the key index writes for a batch of operations.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import type { OperationWithContext } from "document-model";
import { describe, expect, it } from "vitest";
import { rowsFor } from "./processor.js";
import { KEYED_TYPES, valueAt } from "./keys.js";

function op(
  documentId: string,
  type: string,
  input: unknown,
  over: { documentType?: string; scope?: string } = {},
): OperationWithContext {
  return {
    operation: { action: { type, input } },
    context: {
      documentId,
      documentType: over.documentType ?? "sektar/email",
      scope: over.scope ?? "global",
    },
  } as unknown as OperationWithContext;
}

describe("rows off operations", () => {
  it("takes the key from the capture's input, one row per document and key", () => {
    const { rows, deleted } = rowsFor(
      [
        op("d1", "SET_ACCOUNT", { address: "a@b.c" }),
        op("d1", "CAPTURE_MESSAGE", { externalId: "gmail:1", subject: "x" }),
        // A re-capture of the same key adds nothing.
        op("d1", "CAPTURE_MESSAGE", { externalId: "gmail:1", subject: "y" }),
        op("d2", "CAPTURE_MESSAGE", { externalId: " gmail:2 " }),
      ],
      KEYED_TYPES,
    );
    expect(rows).toEqual([
      { document_type: "sektar/email", key: "gmail:1", document_id: "d1" },
      { document_type: "sektar/email", key: "gmail:2", document_id: "d2" },
    ]);
    expect(deleted).toEqual([]);
  });

  it("ignores other types, other scopes, and inputs with no usable key", () => {
    const { rows } = rowsFor(
      [
        op("i1", "CAPTURE_MESSAGE", { externalId: "x" }, { documentType: "sektar/invoice" }),
        op("d1", "CAPTURE_MESSAGE", { externalId: "gmail:1" }, { scope: "local" }),
        op("d2", "CAPTURE_MESSAGE", { externalId: "" }),
        op("d3", "CAPTURE_MESSAGE", { externalId: { nested: true } }),
        op("d4", "CAPTURE_MESSAGE", null),
      ],
      KEYED_TYPES,
    );
    expect(rows).toEqual([]);
  });

  it("drops a deleted document's rows, including ones this batch added", () => {
    const { rows, deleted } = rowsFor(
      [
        op("d1", "CAPTURE_MESSAGE", { externalId: "gmail:1" }),
        op("d1", "DELETE_DOCUMENT", { documentId: "d1" }, { scope: "document" }),
        op("d2", "CAPTURE_MESSAGE", { externalId: "gmail:2" }),
      ],
      KEYED_TYPES,
    );
    expect(rows.map((r) => r.document_id)).toEqual(["d2"]);
    expect(deleted).toEqual(["d1"]);
  });

  it("reads a dotted path and accepts a numeric key", () => {
    expect(valueAt({ a: { b: 7 } }, "a.b")).toBe(7);
    const { rows } = rowsFor(
      [op("d9", "SET_REF", { ref: { id: 42 } }, { documentType: "acme/thing" })],
      [{ documentType: "acme/thing", actions: [{ type: "SET_REF", path: "ref.id" }] }],
    );
    expect(rows).toEqual([{ document_type: "acme/thing", key: "42", document_id: "d9" }]);
  });
});
