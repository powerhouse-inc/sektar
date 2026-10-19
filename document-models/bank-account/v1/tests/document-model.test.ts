/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */
/**
 * This is a scaffold file meant for customization:
 * - change it by adding new tests or modifying the existing ones
 */

import {
  assertIsBankAccountDocument,
  assertIsBankAccountState,
  bankAccountDocumentType,
  initialGlobalState,
  initialLocalState,
  isBankAccountDocument,
  isBankAccountState,
  utils,
} from "document-models/bank-account/v1";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

describe("BankAccount Document Model", () => {
  it("should create a new BankAccount document", () => {
    const document = utils.createDocument();

    expect(document).toBeDefined();
    expect(document.header.documentType).toBe(bankAccountDocumentType);
  });

  it("should create a new BankAccount document with a valid initial state", () => {
    const document = utils.createDocument();
    expect(document.state.global).toStrictEqual(initialGlobalState);
    expect(document.state.local).toStrictEqual(initialLocalState);
    expect(isBankAccountDocument(document)).toBe(true);
    expect(isBankAccountState(document.state)).toBe(true);
  });
  it("should reject a document that is not a BankAccount document", () => {
    const wrongDocumentType = utils.createDocument();
    wrongDocumentType.header.documentType = "the-wrong-thing-1234";
    try {
      expect(assertIsBankAccountDocument(wrongDocumentType)).toThrow();
      expect(isBankAccountDocument(wrongDocumentType)).toBe(false);
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
    expect(isBankAccountState(wrongState.state)).toBe(false);
    expect(assertIsBankAccountState(wrongState.state)).toThrow();
    expect(isBankAccountDocument(wrongState)).toBe(false);
    expect(assertIsBankAccountDocument(wrongState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const wrongInitialState = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  wrongInitialState.initialState.global = {
    ...{ notWhat: "you want" },
  };
  try {
    expect(isBankAccountState(wrongInitialState.state)).toBe(false);
    expect(assertIsBankAccountState(wrongInitialState.state)).toThrow();
    expect(isBankAccountDocument(wrongInitialState)).toBe(false);
    expect(assertIsBankAccountDocument(wrongInitialState)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingIdInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingIdInHeader.header.id;
  try {
    expect(isBankAccountDocument(missingIdInHeader)).toBe(false);
    expect(assertIsBankAccountDocument(missingIdInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingNameInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingNameInHeader.header.name;
  try {
    expect(isBankAccountDocument(missingNameInHeader)).toBe(false);
    expect(assertIsBankAccountDocument(missingNameInHeader)).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingCreatedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingCreatedAtUtcIsoInHeader.header.createdAtUtcIso;
  try {
    expect(isBankAccountDocument(missingCreatedAtUtcIsoInHeader)).toBe(false);
    expect(
      assertIsBankAccountDocument(missingCreatedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }

  const missingLastModifiedAtUtcIsoInHeader = utils.createDocument();
  // @ts-expect-error - we are testing the error case
  delete missingLastModifiedAtUtcIsoInHeader.header.lastModifiedAtUtcIso;
  try {
    expect(isBankAccountDocument(missingLastModifiedAtUtcIsoInHeader)).toBe(
      false,
    );
    expect(
      assertIsBankAccountDocument(missingLastModifiedAtUtcIsoInHeader),
    ).toThrow();
  } catch (error) {
    expect(error).toBeInstanceOf(ZodError);
  }
});
