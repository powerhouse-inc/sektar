/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsIntegrationDocument,
  assertIsIntegrationState,
  initialGlobalState,
  initialLocalState,
  integrationDocumentType,
  isIntegrationDocument,
  isIntegrationState,
  utils,
} from "document-models/integration/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("Integration Document Model", () => {
  it("should create a new Integration document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(integrationDocumentType);
  });

  it("should create a new Integration document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isIntegrationDocument(document)).toBe(true);
    expect(isIntegrationState(document.state)).toBe(true);
  });
  it("should reject a document that is not a Integration document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(assertIsIntegrationDocument(wrongDocumentType)).toThrow();
      expect(isIntegrationDocument(wrongDocumentType)).toBe(false);
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
    expect(isIntegrationState(wrongState.state)).toBe(false);
    expect(assertIsIntegrationState(wrongState.state)).toThrow();
    expect(isIntegrationDocument(wrongState)).toBe(false);
    expect(assertIsIntegrationDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isIntegrationState(wrongInitialState.state)).toBe(false);
    expect(assertIsIntegrationState(wrongInitialState.state)).toThrow();
    expect(isIntegrationDocument(wrongInitialState)).toBe(false);
    expect(assertIsIntegrationDocument(wrongInitialState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isIntegrationDocument(missingIdInHeader)).toBe(false);
    expect(assertIsIntegrationDocument(missingIdInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isIntegrationDocument(missingNameInHeader)).toBe(false);
    expect(assertIsIntegrationDocument(missingNameInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(isIntegrationDocument(missingCreatedAtUtcIsoInHeader)).toBe(false);
    expect(
      assertIsIntegrationDocument(missingCreatedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(isIntegrationDocument(missingLastModifiedAtUtcIsoInHeader)).toBe(
      false,
    );
    expect(
      assertIsIntegrationDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
