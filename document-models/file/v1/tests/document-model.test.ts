/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsFileDocument,
  assertIsFileState,
  fileDocumentType,
  initialGlobalState,
  initialLocalState,
  isFileDocument,
  isFileState,
  utils,
} from "document-models/file/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("File Document Model", () => {
  it("should create a new File document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(fileDocumentType);
  });

  it("should create a new File document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isFileDocument(document)).toBe(true);
    expect(isFileState(document.state)).toBe(true);
  });
  it("should reject a document that is not a File document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(assertIsFileDocument(wrongDocumentType)).toThrow();
      expect(isFileDocument(wrongDocumentType)).toBe(false);
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
    expect(isFileState(wrongState.state)).toBe(false);
    expect(assertIsFileState(wrongState.state)).toThrow();
    expect(isFileDocument(wrongState)).toBe(false);
    expect(assertIsFileDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isFileState(wrongInitialState.state)).toBe(false);
    expect(assertIsFileState(wrongInitialState.state)).toThrow();
    expect(isFileDocument(wrongInitialState)).toBe(false);
    expect(assertIsFileDocument(wrongInitialState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isFileDocument(missingIdInHeader)).toBe(false);
    expect(assertIsFileDocument(missingIdInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isFileDocument(missingNameInHeader)).toBe(false);
    expect(assertIsFileDocument(missingNameInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(isFileDocument(missingCreatedAtUtcIsoInHeader)).toBe(false);
    expect(assertIsFileDocument(missingCreatedAtUtcIsoInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(isFileDocument(missingLastModifiedAtUtcIsoInHeader)).toBe(false);
    expect(assertIsFileDocument(missingLastModifiedAtUtcIsoInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
