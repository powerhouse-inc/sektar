/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsOriginalSourceQueueDocument,
  assertIsOriginalSourceQueueState,
  initialGlobalState,
  initialLocalState,
  isOriginalSourceQueueDocument,
  isOriginalSourceQueueState,
  originalSourceQueueDocumentType,
  utils,
} from "document-models/original-source-queue/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("OriginalSourceQueue Document Model", () => {
  it("should create a new OriginalSourceQueue document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(originalSourceQueueDocumentType);
  });

  it("should create a new OriginalSourceQueue document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isOriginalSourceQueueDocument(document)).toBe(true);
    expect(isOriginalSourceQueueState(document.state)).toBe(true);
  });
  it("should reject a document that is not a OriginalSourceQueue document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(assertIsOriginalSourceQueueDocument(wrongDocumentType)).toThrow();
      expect(isOriginalSourceQueueDocument(wrongDocumentType)).toBe(false);
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
    expect(isOriginalSourceQueueState(wrongState.state)).toBe(false);
    expect(assertIsOriginalSourceQueueState(wrongState.state)).toThrow();
    expect(isOriginalSourceQueueDocument(wrongState)).toBe(false);
    expect(assertIsOriginalSourceQueueDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isOriginalSourceQueueState(wrongInitialState.state)).toBe(false);
    expect(assertIsOriginalSourceQueueState(wrongInitialState.state)).toThrow();
    expect(isOriginalSourceQueueDocument(wrongInitialState)).toBe(false);
    expect(assertIsOriginalSourceQueueDocument(wrongInitialState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isOriginalSourceQueueDocument(missingIdInHeader)).toBe(false);
    expect(assertIsOriginalSourceQueueDocument(missingIdInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isOriginalSourceQueueDocument(missingNameInHeader)).toBe(false);
    expect(assertIsOriginalSourceQueueDocument(missingNameInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(isOriginalSourceQueueDocument(missingCreatedAtUtcIsoInHeader)).toBe(
      false,
    );
    expect(
      assertIsOriginalSourceQueueDocument(missingCreatedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(
      isOriginalSourceQueueDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toBe(false);
    expect(
      assertIsOriginalSourceQueueDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
