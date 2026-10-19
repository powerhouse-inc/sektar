import { generateMock } from "document-model/mock";
import {
  addSourceReference,
  AddSourceReferenceInputSchema,
  attachToSource,
  AttachToSourceInputSchema,
  captureSource,
  CaptureSourceInputSchema,
  detachFromSource,
  DetachFromSourceInputSchema,
  isOriginalSourceCollectionDocument,
  reducer,
  utils,
} from "document-models/original-source-collection/v1";
import { describe, expect, it } from "vitest";

describe("CaptureOperations", () => {
  it("should handle captureSource operation", () => {
    const document = utils.createDocument();
    // Codegen fills any URL-named field with a single URL, even a list one,
    // and does not know identifiers must name their system.
    const input = generateMock(CaptureSourceInputSchema(), {
      externalId: "gmail:18f3a",
      aliases: [],
      // zocker has no generator for a custom scalar, so it cannot fabricate
      // an AttachmentRef; real attachment behaviour is covered in
      // capture-identity.test.ts.
      attachments: [],
      origin: "https://example.com",
      references: ["https://example.com"],
      occurredAt: "2024-01-01T00:00:00.000Z",
      capturedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, captureSource(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "CAPTURE_SOURCE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle attachToSource operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AttachToSourceInputSchema(), {
      ref: "attachment://v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });

    const updatedDocument = reducer(document, attachToSource(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "ATTACH_TO_SOURCE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle detachFromSource operation", () => {
    const document = utils.createDocument();
    const input = generateMock(DetachFromSourceInputSchema(), {
      ref: "attachment://v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });

    const updatedDocument = reducer(document, detachFromSource(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "DETACH_FROM_SOURCE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle addSourceReference operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AddSourceReferenceInputSchema());

    const updatedDocument = reducer(document, addSourceReference(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "ADD_SOURCE_REFERENCE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
