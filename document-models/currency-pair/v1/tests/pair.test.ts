import { generateMock } from "document-model/mock";
import {
  isCurrencyPairDocument,
  reducer,
  setPair,
  SetPairInputSchema,
  utils,
} from "document-models/currency-pair/v1";
import { describe, expect, it } from "vitest";

describe("PairOperations", () => {
  it("should handle setPair operation", () => {
    const document = utils.createDocument();
    const input = {
      ...generateMock(SetPairInputSchema()),
      base: "USD",
      quote: "EUR",
    };

    const updatedDocument = reducer(document, setPair(input));

    expect(isCurrencyPairDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    // A rejected operation records its error; give it the state it needs.
    expect(updatedDocument.operations.global[0].error).toBeUndefined();
    expect(updatedDocument.operations.global[0].action.type).toBe("SET_PAIR");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
