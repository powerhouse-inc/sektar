import { generateMock } from "document-model/mock";
import {
  createCollection,
  createCollectionCursor,
  CreateCollectionCursorInputSchema,
  CreateCollectionInputSchema,
  createDateTimeCursor,
  CreateDateTimeCursorInputSchema,
  createNumberCursor,
  CreateNumberCursorInputSchema,
  isOriginalSourceQueueDocument,
  reducer,
  reorderCursors,
  ReorderCursorsInputSchema,
  setCursorName,
  SetCursorNameInputSchema,
  utils,
} from "document-models/original-source-queue/v1";
import { describe, expect, it } from "vitest";

describe("DefinitionOperations", () => {
  it("should handle createDateTimeCursor operation", () => {
    const document = utils.createDocument();
    const input = generateMock(CreateDateTimeCursorInputSchema(), {
      first: "2024-01-01T00:00:00.000Z",
      last: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, createDateTimeCursor(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "CREATE_DATE_TIME_CURSOR",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle createNumberCursor operation", () => {
    const document = utils.createDocument();
    // Codegen fills any field named first/last with an instant, which is
    // wrong for a number cursor; and step must be positive or the reducer
    // rightly refuses it.
    const input = generateMock(CreateNumberCursorInputSchema(), {
      first: 1,
      last: 52,
      step: 1,
    });

    const updatedDocument = reducer(document, createNumberCursor(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "CREATE_NUMBER_CURSOR",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle createCollectionCursor operation", () => {
    const document = utils.createDocument();
    const input = generateMock(CreateCollectionCursorInputSchema());

    const updatedDocument = reducer(document, createCollectionCursor(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "CREATE_COLLECTION_CURSOR",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle reorderCursors operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ReorderCursorsInputSchema());

    const updatedDocument = reducer(document, reorderCursors(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REORDER_CURSORS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setCursorName operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetCursorNameInputSchema());

    const updatedDocument = reducer(document, setCursorName(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_CURSOR_NAME",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle createCollection operation", () => {
    const document = utils.createDocument();
    const input = generateMock(CreateCollectionInputSchema());

    const updatedDocument = reducer(document, createCollection(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "CREATE_COLLECTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
