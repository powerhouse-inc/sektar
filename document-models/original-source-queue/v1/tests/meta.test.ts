import { generateMock } from "document-model/mock";
import {
  isOriginalSourceQueueDocument,
  reducer,
  setCursorDescription,
  SetCursorDescriptionInputSchema,
  setDescription,
  SetDescriptionInputSchema,
  utils,
} from "document-models/original-source-queue/v1";
import { describe, expect, it } from "vitest";

describe("MetaOperations", () => {
  it("should handle setDescription operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetDescriptionInputSchema());

    const updatedDocument = reducer(document, setDescription(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_DESCRIPTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setCursorDescription operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetCursorDescriptionInputSchema());

    const updatedDocument = reducer(document, setCursorDescription(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_CURSOR_DESCRIPTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
