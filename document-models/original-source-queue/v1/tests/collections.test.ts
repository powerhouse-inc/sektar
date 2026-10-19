import { generateMock } from "document-model/mock";
import {
  addCollectionValue,
  AddCollectionValueInputSchema,
  clearCollection,
  ClearCollectionInputSchema,
  isOriginalSourceQueueDocument,
  reducer,
  utils,
} from "document-models/original-source-queue/v1";
import { describe, expect, it } from "vitest";

describe("CollectionsOperations", () => {
  it("should handle addCollectionValue operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AddCollectionValueInputSchema());

    const updatedDocument = reducer(document, addCollectionValue(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "ADD_COLLECTION_VALUE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle clearCollection operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ClearCollectionInputSchema());

    const updatedDocument = reducer(document, clearCollection(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "CLEAR_COLLECTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
