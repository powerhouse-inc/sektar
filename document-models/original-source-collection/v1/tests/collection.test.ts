import { generateMock } from "document-model/mock";
import {
  discardCollection,
  DiscardCollectionInputSchema,
  isOriginalSourceCollectionDocument,
  reducer,
  restoreCollection,
  RestoreCollectionInputSchema,
  setDescription,
  SetDescriptionInputSchema,
  setProvenance,
  SetProvenanceInputSchema,
  setTitle,
  SetTitleInputSchema,
  utils,
} from "document-models/original-source-collection/v1";
import { describe, expect, it } from "vitest";

describe("CollectionOperations", () => {
  it("should handle setTitle operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetTitleInputSchema());

    const updatedDocument = reducer(document, setTitle(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("SET_TITLE");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setDescription operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetDescriptionInputSchema());

    const updatedDocument = reducer(document, setDescription(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_DESCRIPTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setProvenance operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetProvenanceInputSchema());

    const updatedDocument = reducer(document, setProvenance(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_PROVENANCE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle discardCollection operation", () => {
    const document = utils.createDocument();
    const input = generateMock(DiscardCollectionInputSchema());

    const updatedDocument = reducer(document, discardCollection(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "DISCARD_COLLECTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle restoreCollection operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RestoreCollectionInputSchema());

    const updatedDocument = reducer(document, restoreCollection(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "RESTORE_COLLECTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
