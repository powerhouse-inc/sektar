import { generateMock } from "document-model/mock";
import {
  addRendition,
  AddRenditionInputSchema,
  isFileDocument,
  reducer,
  removeRendition,
  RemoveRenditionInputSchema,
  updateRendition,
  UpdateRenditionInputSchema,
  utils,
} from "document-models/file/v1";
import { describe, expect, it } from "vitest";

describe("RenditionsOperations", () => {
  it("should handle addRendition operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AddRenditionInputSchema(), {
      ref: "attachment://v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, addRendition(input));

    expect(isFileDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "ADD_RENDITION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle updateRendition operation", () => {
    const document = utils.createDocument();
    const input = generateMock(UpdateRenditionInputSchema());

    const updatedDocument = reducer(document, updateRendition(input));

    expect(isFileDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "UPDATE_RENDITION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle removeRendition operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RemoveRenditionInputSchema());

    const updatedDocument = reducer(document, removeRendition(input));

    expect(isFileDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REMOVE_RENDITION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
