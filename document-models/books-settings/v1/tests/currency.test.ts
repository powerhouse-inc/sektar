import { generateMock } from "document-model/mock";
import {
  isBooksSettingsDocument,
  reducer,
  setBaseCurrency,
  SetBaseCurrencyInputSchema,
  utils,
} from "document-models/books-settings/v1";
import { describe, expect, it } from "vitest";

describe("CurrencyOperations", () => {
  it("should handle setBaseCurrency operation", () => {
    const document = utils.createDocument();
    const input = {
      ...generateMock(SetBaseCurrencyInputSchema()),
      currency: "USD",
    };

    const updatedDocument = reducer(document, setBaseCurrency(input));

    expect(isBooksSettingsDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    // A rejected operation records its error; give it the state it needs.
    expect(updatedDocument.operations.global[0].error).toBeUndefined();
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_BASE_CURRENCY",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
