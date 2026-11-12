import { generateMock } from "document-model/mock";
import {
  correctCurrency,
  CorrectCurrencyInputSchema,
  isBankAccountDocument,
  reducer,
  setAccountDetails,
  SetAccountDetailsInputSchema,
  utils,
} from "document-models/bank-account/v1";
import { describe, expect, it } from "vitest";

describe("AccountOperations", () => {
  it("should handle setAccountDetails operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetAccountDetailsInputSchema());

    const updatedDocument = reducer(document, setAccountDetails(input));

    expect(isBankAccountDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_ACCOUNT_DETAILS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle correctCurrency operation", () => {
    const document = utils.createDocument();
    const input = {
      ...generateMock(CorrectCurrencyInputSchema()),
      currency: "RON",
    };

    const updatedDocument = reducer(document, correctCurrency(input));

    expect(isBankAccountDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    // A rejected operation records its error; give it the state it needs.
    expect(updatedDocument.operations.global[0].error).toBeUndefined();
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "CORRECT_CURRENCY",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
