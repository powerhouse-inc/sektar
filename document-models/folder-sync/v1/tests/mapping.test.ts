import { generateMock } from "document-model/mock";
import {
  isFolderSyncDocument,
  reducer,
  setEnabled,
  SetEnabledInputSchema,
  setLocalPath,
  SetLocalPathInputSchema,
  setOptions,
  SetOptionsInputSchema,
  setTarget,
  SetTargetInputSchema,
  utils,
} from "document-models/folder-sync/v1";
import { describe, expect, it } from "vitest";

describe("MappingOperations", () => {
  it("should handle setTarget operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetTargetInputSchema());

    const updatedDocument = reducer(document, setTarget(input));

    expect(isFolderSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("SET_TARGET");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setLocalPath operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetLocalPathInputSchema());

    const updatedDocument = reducer(document, setLocalPath(input));

    expect(isFolderSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_LOCAL_PATH",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setOptions operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetOptionsInputSchema());

    const updatedDocument = reducer(document, setOptions(input));

    expect(isFolderSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_OPTIONS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setEnabled operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetEnabledInputSchema());

    const updatedDocument = reducer(document, setEnabled(input));

    expect(isFolderSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_ENABLED",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
