/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsOriginalSourceCollectionDocument,
  assertIsOriginalSourceCollectionState,
  initialGlobalState,
  initialLocalState,
  isOriginalSourceCollectionDocument,
  isOriginalSourceCollectionState,
  originalSourceCollectionDocumentType,
  utils,
} from "document-models/original-source-collection/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("OriginalSourceCollection Document Model", () => {
  it("should create a new OriginalSourceCollection document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(
      originalSourceCollectionDocumentType,
    );
  });

  it("should create a new OriginalSourceCollection document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isOriginalSourceCollectionDocument(document)).toBe(true);
    expect(isOriginalSourceCollectionState(document.state)).toBe(true);
  });
  it("should reject a document that is not a OriginalSourceCollection document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(
        assertIsOriginalSourceCollectionDocument(wrongDocumentType),
      ).toThrow();
      expect(isOriginalSourceCollectionDocument(wrongDocumentType)).toBe(false);
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
    expect(isOriginalSourceCollectionState(wrongState.state)).toBe(false);
    expect(assertIsOriginalSourceCollectionState(wrongState.state)).toThrow();
    expect(isOriginalSourceCollectionDocument(wrongState)).toBe(false);
    expect(assertIsOriginalSourceCollectionDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isOriginalSourceCollectionState(wrongInitialState.state)).toBe(
      false,
    );
    expect(
      assertIsOriginalSourceCollectionState(wrongInitialState.state),
    ).toThrow();
    expect(isOriginalSourceCollectionDocument(wrongInitialState)).toBe(false);
    expect(
      assertIsOriginalSourceCollectionDocument(wrongInitialState),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isOriginalSourceCollectionDocument(missingIdInHeader)).toBe(false);
    expect(
      assertIsOriginalSourceCollectionDocument(missingIdInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isOriginalSourceCollectionDocument(missingNameInHeader)).toBe(false);
    expect(
      assertIsOriginalSourceCollectionDocument(missingNameInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(
      isOriginalSourceCollectionDocument(missingCreatedAtUtcIsoInHeader),
    ).toBe(false);
    expect(
      assertIsOriginalSourceCollectionDocument(missingCreatedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(
      isOriginalSourceCollectionDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toBe(false);
    expect(
      assertIsOriginalSourceCollectionDocument(
        missingLastModifiedAtUtcIsoInHeader,
      ),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
