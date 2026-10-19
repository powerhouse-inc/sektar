import { generateMock } from "document-model/mock";
import {
  addAlias,
  AddAliasInputSchema,
  isOriginalSourceCollectionDocument,
  mergeSources,
  MergeSourcesInputSchema,
  reducer,
  removeAlias,
  RemoveAliasInputSchema,
  splitSource,
  SplitSourceInputSchema,
  utils,
} from "document-models/original-source-collection/v1";
import { describe, expect, it } from "vitest";

describe("IdentityOperations", () => {
  it("should handle addAlias operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AddAliasInputSchema());

    const updatedDocument = reducer(document, addAlias(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("ADD_ALIAS");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle removeAlias operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RemoveAliasInputSchema());

    const updatedDocument = reducer(document, removeAlias(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REMOVE_ALIAS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle mergeSources operation", () => {
    const document = utils.createDocument();
    const input = generateMock(MergeSourcesInputSchema(), {
      mergedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, mergeSources(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "MERGE_SOURCES",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle splitSource operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SplitSourceInputSchema());

    const updatedDocument = reducer(document, splitSource(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SPLIT_SOURCE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
