/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsEmailDocument,
  assertIsEmailState,
  emailDocumentType,
  initialGlobalState,
  initialLocalState,
  isEmailDocument,
  isEmailState,
  utils,
} from "document-models/email/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("Email Document Model", () => {
  it("should create a new Email document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(emailDocumentType);
  });

  it("should create a new Email document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isEmailDocument(document)).toBe(true);
    expect(isEmailState(document.state)).toBe(true);
  });
  it("should reject a document that is not a Email document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(assertIsEmailDocument(wrongDocumentType)).toThrow();
      expect(isEmailDocument(wrongDocumentType)).toBe(false);
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
    expect(isEmailState(wrongState.state)).toBe(false);
    expect(assertIsEmailState(wrongState.state)).toThrow();
    expect(isEmailDocument(wrongState)).toBe(false);
    expect(assertIsEmailDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isEmailState(wrongInitialState.state)).toBe(false);
    expect(assertIsEmailState(wrongInitialState.state)).toThrow();
    expect(isEmailDocument(wrongInitialState)).toBe(false);
    expect(assertIsEmailDocument(wrongInitialState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isEmailDocument(missingIdInHeader)).toBe(false);
    expect(assertIsEmailDocument(missingIdInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isEmailDocument(missingNameInHeader)).toBe(false);
    expect(assertIsEmailDocument(missingNameInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(isEmailDocument(missingCreatedAtUtcIsoInHeader)).toBe(false);
    expect(assertIsEmailDocument(missingCreatedAtUtcIsoInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(isEmailDocument(missingLastModifiedAtUtcIsoInHeader)).toBe(false);
    expect(
      assertIsEmailDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
