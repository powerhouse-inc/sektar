import { generateMock } from "document-model/mock";
import {
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
});
