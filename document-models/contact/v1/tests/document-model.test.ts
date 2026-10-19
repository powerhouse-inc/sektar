/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsContactDocument,
  assertIsContactState,
  contactDocumentType,
  initialGlobalState,
  initialLocalState,
  isContactDocument,
  isContactState,
  utils,
} from "document-models/contact/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("Contact Document Model", () => {
  it("should create a new Contact document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(contactDocumentType);
  });

  it("should create a new Contact document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isContactDocument(document)).toBe(true);
    expect(isContactState(document.state)).toBe(true);
  });
  it("should reject a document that is not a Contact document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(assertIsContactDocument(wrongDocumentType)).toThrow();
      expect(isContactDocument(wrongDocumentType)).toBe(false);
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
    expect(isContactState(wrongState.state)).toBe(false);
    expect(assertIsContactState(wrongState.state)).toThrow();
    expect(isContactDocument(wrongState)).toBe(false);
    expect(assertIsContactDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isContactState(wrongInitialState.state)).toBe(false);
    expect(assertIsContactState(wrongInitialState.state)).toThrow();
    expect(isContactDocument(wrongInitialState)).toBe(false);
    expect(assertIsContactDocument(wrongInitialState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isContactDocument(missingIdInHeader)).toBe(false);
    expect(assertIsContactDocument(missingIdInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isContactDocument(missingNameInHeader)).toBe(false);
    expect(assertIsContactDocument(missingNameInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(isContactDocument(missingCreatedAtUtcIsoInHeader)).toBe(false);
    expect(assertIsContactDocument(missingCreatedAtUtcIsoInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(isContactDocument(missingLastModifiedAtUtcIsoInHeader)).toBe(false);
    expect(
      assertIsContactDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
