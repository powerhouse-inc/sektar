/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsCurrencyPairDocument,
  assertIsCurrencyPairState,
  currencyPairDocumentType,
  initialGlobalState,
  initialLocalState,
  isCurrencyPairDocument,
  isCurrencyPairState,
  utils,
} from "document-models/currency-pair/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("CurrencyPair Document Model", () => {
  it("should create a new CurrencyPair document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(currencyPairDocumentType);
  });

  it("should create a new CurrencyPair document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isCurrencyPairDocument(document)).toBe(true);
    expect(isCurrencyPairState(document.state)).toBe(true);
  });
  it("should reject a document that is not a CurrencyPair document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(assertIsCurrencyPairDocument(wrongDocumentType)).toThrow();
      expect(isCurrencyPairDocument(wrongDocumentType)).toBe(false);
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
    expect(isCurrencyPairState(wrongState.state)).toBe(false);
    expect(assertIsCurrencyPairState(wrongState.state)).toThrow();
    expect(isCurrencyPairDocument(wrongState)).toBe(false);
    expect(assertIsCurrencyPairDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isCurrencyPairState(wrongInitialState.state)).toBe(false);
    expect(assertIsCurrencyPairState(wrongInitialState.state)).toThrow();
    expect(isCurrencyPairDocument(wrongInitialState)).toBe(false);
    expect(assertIsCurrencyPairDocument(wrongInitialState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isCurrencyPairDocument(missingIdInHeader)).toBe(false);
    expect(assertIsCurrencyPairDocument(missingIdInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isCurrencyPairDocument(missingNameInHeader)).toBe(false);
    expect(assertIsCurrencyPairDocument(missingNameInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(isCurrencyPairDocument(missingCreatedAtUtcIsoInHeader)).toBe(false);
    expect(
      assertIsCurrencyPairDocument(missingCreatedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(isCurrencyPairDocument(missingLastModifiedAtUtcIsoInHeader)).toBe(
      false,
    );
    expect(
      assertIsCurrencyPairDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
