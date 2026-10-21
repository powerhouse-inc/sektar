/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsFolderSyncDocument,
  assertIsFolderSyncState,
  folderSyncDocumentType,
  initialGlobalState,
  initialLocalState,
  isFolderSyncDocument,
  isFolderSyncState,
  utils,
} from "document-models/folder-sync/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("FolderSync Document Model", () => {
  it("should create a new FolderSync document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(folderSyncDocumentType);
  });

  it("should create a new FolderSync document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isFolderSyncDocument(document)).toBe(true);
    expect(isFolderSyncState(document.state)).toBe(true);
  });
  it("should reject a document that is not a FolderSync document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(assertIsFolderSyncDocument(wrongDocumentType)).toThrow();
      expect(isFolderSyncDocument(wrongDocumentType)).toBe(false);
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
    }
  });
  const wrongState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongState.state.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isFolderSyncState(wrongState.state)).toBe(false);
    expect(assertIsFolderSyncState(wrongState.state)).toThrow();
    expect(isFolderSyncDocument(wrongState)).toBe(false);
    expect(assertIsFolderSyncDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isFolderSyncState(wrongInitialState.state)).toBe(false);
    expect(assertIsFolderSyncState(wrongInitialState.state)).toThrow();
    expect(isFolderSyncDocument(wrongInitialState)).toBe(false);
    expect(assertIsFolderSyncDocument(wrongInitialState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isFolderSyncDocument(missingIdInHeader)).toBe(false);
    expect(assertIsFolderSyncDocument(missingIdInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isFolderSyncDocument(missingNameInHeader)).toBe(false);
    expect(assertIsFolderSyncDocument(missingNameInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(isFolderSyncDocument(missingCreatedAtUtcIsoInHeader)).toBe(false);
    expect(
      assertIsFolderSyncDocument(missingCreatedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(isFolderSyncDocument(missingLastModifiedAtUtcIsoInHeader)).toBe(
      false,
    );
    expect(
      assertIsFolderSyncDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
