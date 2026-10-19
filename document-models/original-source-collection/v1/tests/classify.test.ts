import { generateMock } from "document-model/mock";
import {
  discardSource,
  DiscardSourceInputSchema,
  isOriginalSourceCollectionDocument,
  reducer,
  setSourceStatus,
  SetSourceStatusInputSchema,
  setSourceTitle,
  SetSourceTitleInputSchema,
  tagSource,
  TagSourceInputSchema,
  untagSource,
  UntagSourceInputSchema,
  utils,
} from "document-models/original-source-collection/v1";
import { describe, expect, it } from "vitest";

describe("ClassifyOperations", () => {
  it("should handle setSourceTitle operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetSourceTitleInputSchema());

    const updatedDocument = reducer(document, setSourceTitle(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_SOURCE_TITLE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle tagSource operation", () => {
    const document = utils.createDocument();
    const input = generateMock(TagSourceInputSchema());

    const updatedDocument = reducer(document, tagSource(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("TAG_SOURCE");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle untagSource operation", () => {
    const document = utils.createDocument();
    const input = generateMock(UntagSourceInputSchema());

    const updatedDocument = reducer(document, untagSource(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "UNTAG_SOURCE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setSourceStatus operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetSourceStatusInputSchema());

    const updatedDocument = reducer(document, setSourceStatus(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_SOURCE_STATUS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle discardSource operation", () => {
    const document = utils.createDocument();
    const input = generateMock(DiscardSourceInputSchema());

    const updatedDocument = reducer(document, discardSource(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "DISCARD_SOURCE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
