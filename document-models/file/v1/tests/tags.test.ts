import { generateMock } from "document-model/mock";
import {
  addTag,
  AddTagInputSchema,
  isFileDocument,
  reducer,
  removeTag,
  RemoveTagInputSchema,
  updateTag,
  UpdateTagInputSchema,
  utils,
} from "document-models/file/v1";
import { describe, expect, it } from "vitest";

describe("TagsOperations", () => {
  it("should handle addTag operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AddTagInputSchema());

    const updatedDocument = reducer(document, addTag(input));

    expect(isFileDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("ADD_TAG");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle updateTag operation", () => {
    const document = utils.createDocument();
    const input = generateMock(UpdateTagInputSchema());

    const updatedDocument = reducer(document, updateTag(input));

    expect(isFileDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("UPDATE_TAG");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle removeTag operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RemoveTagInputSchema());

    const updatedDocument = reducer(document, removeTag(input));

    expect(isFileDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("REMOVE_TAG");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
