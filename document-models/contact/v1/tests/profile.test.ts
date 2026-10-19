import { generateMock } from "document-model/mock";
import {
  addTag,
  AddTagInputSchema,
  isContactDocument,
  reducer,
  removeTag,
  RemoveTagInputSchema,
  setAddress,
  SetAddressInputSchema,
  setBankDetails,
  SetBankDetailsInputSchema,
  setPaymentTerms,
  SetPaymentTermsInputSchema,
  setProfile,
  SetProfileInputSchema,
  utils,
} from "document-models/contact/v1";
import { describe, expect, it } from "vitest";

describe("ProfileOperations", () => {
  it("should handle setProfile operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetProfileInputSchema());

    const updatedDocument = reducer(document, setProfile(input));

    expect(isContactDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_PROFILE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setAddress operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetAddressInputSchema());

    const updatedDocument = reducer(document, setAddress(input));

    expect(isContactDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_ADDRESS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setBankDetails operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetBankDetailsInputSchema());

    const updatedDocument = reducer(document, setBankDetails(input));

    expect(isContactDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_BANK_DETAILS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setPaymentTerms operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetPaymentTermsInputSchema());

    const updatedDocument = reducer(document, setPaymentTerms(input));

    expect(isContactDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_PAYMENT_TERMS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle addTag operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AddTagInputSchema());

    const updatedDocument = reducer(document, addTag(input));

    expect(isContactDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("ADD_TAG");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle removeTag operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RemoveTagInputSchema());

    const updatedDocument = reducer(document, removeTag(input));

    expect(isContactDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("REMOVE_TAG");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
