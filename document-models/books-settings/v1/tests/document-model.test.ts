/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsBooksSettingsDocument,
  assertIsBooksSettingsState,
  booksSettingsDocumentType,
  initialGlobalState,
  initialLocalState,
  isBooksSettingsDocument,
  isBooksSettingsState,
  utils,
} from "document-models/books-settings/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("BooksSettings Document Model", () => {
  it("should create a new BooksSettings document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(booksSettingsDocumentType);
  });

  it("should create a new BooksSettings document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isBooksSettingsDocument(document)).toBe(true);
    expect(isBooksSettingsState(document.state)).toBe(true);
  });
  it("should reject a document that is not a BooksSettings document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(assertIsBooksSettingsDocument(wrongDocumentType)).toThrow();
      expect(isBooksSettingsDocument(wrongDocumentType)).toBe(false);
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
    expect(isBooksSettingsState(wrongState.state)).toBe(false);
    expect(assertIsBooksSettingsState(wrongState.state)).toThrow();
    expect(isBooksSettingsDocument(wrongState)).toBe(false);
    expect(assertIsBooksSettingsDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isBooksSettingsState(wrongInitialState.state)).toBe(false);
    expect(assertIsBooksSettingsState(wrongInitialState.state)).toThrow();
    expect(isBooksSettingsDocument(wrongInitialState)).toBe(false);
    expect(assertIsBooksSettingsDocument(wrongInitialState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isBooksSettingsDocument(missingIdInHeader)).toBe(false);
    expect(assertIsBooksSettingsDocument(missingIdInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isBooksSettingsDocument(missingNameInHeader)).toBe(false);
    expect(assertIsBooksSettingsDocument(missingNameInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(isBooksSettingsDocument(missingCreatedAtUtcIsoInHeader)).toBe(false);
    expect(
      assertIsBooksSettingsDocument(missingCreatedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(isBooksSettingsDocument(missingLastModifiedAtUtcIsoInHeader)).toBe(
      false,
    );
    expect(
      assertIsBooksSettingsDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
