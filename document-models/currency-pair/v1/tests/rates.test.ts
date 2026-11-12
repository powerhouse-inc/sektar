import { generateMock } from "document-model/mock";
import {
  isCurrencyPairDocument,
  recordRates,
  RecordRatesInputSchema,
  reducer,
  setPair,
  removeRate,
  RemoveRateInputSchema,
  setManualRate,
  SetManualRateInputSchema,
  utils,
} from "document-models/currency-pair/v1";
import { describe, expect, it } from "vitest";

/** A pair with its currencies named: every rate operation needs them. */
function named() {
  return reducer(
    utils.createDocument(),
    setPair({ base: "USD", quote: "EUR" }),
  );
}

describe("RatesOperations", () => {
  it("should handle recordRates operation", () => {
    const document = named();
    const input = {
      ...generateMock(RecordRatesInputSchema()),
      rates: [{ id: "r1", date: "2026-11-10T00:00:00.000Z", rate: 0.9 }],
    };

    const updatedDocument = reducer(document, recordRates(input));

    expect(isCurrencyPairDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(2);
    // A rejected operation records its error; give it the state it needs.
    expect(updatedDocument.operations.global[1].error).toBeUndefined();
    expect(updatedDocument.operations.global[1].action.type).toBe(
      "RECORD_RATES",
    );
    expect(updatedDocument.operations.global[1].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[1].index).toEqual(1);
  });

  it("should handle setManualRate operation", () => {
    const document = named();
    const input = generateMock(SetManualRateInputSchema(), {
      date: "2024-01-01T00:00:00.000Z",
      // a mocked number may be negative: a rate is above zero
      rate: 0.9,
    });

    const updatedDocument = reducer(document, setManualRate(input));

    expect(isCurrencyPairDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(2);
    // A rejected operation records its error; give it the state it needs.
    expect(updatedDocument.operations.global[1].error).toBeUndefined();
    expect(updatedDocument.operations.global[1].action.type).toBe(
      "SET_MANUAL_RATE",
    );
    expect(updatedDocument.operations.global[1].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[1].index).toEqual(1);
  });

  it("should handle removeRate operation", () => {
    const input = generateMock(RemoveRateInputSchema(), {
      date: "2024-01-01T00:00:00.000Z",
    });
    // A day to remove: the pair holds none of its own.
    const document = reducer(
      named(),
      setManualRate({ id: "m1", date: input.date, rate: 0.9 }),
    );

    const updatedDocument = reducer(document, removeRate(input));

    expect(isCurrencyPairDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(3);
    expect(updatedDocument.operations.global[2].error).toBeUndefined();
    expect(updatedDocument.operations.global[2].action.type).toBe(
      "REMOVE_RATE",
    );
    expect(updatedDocument.operations.global[2].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[2].index).toEqual(2);
  });
});
