import { generateMock } from "document-model/mock";
import {
  isOriginalSourceQueueDocument,
  proceed,
  ProceedInputSchema,
  proceedWithError,
  ProceedWithErrorInputSchema,
  reducer,
  utils,
} from "document-models/original-source-queue/v1";
import { describe, expect, it } from "vitest";

describe("AdvanceOperations", () => {
  it("should handle proceed operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ProceedInputSchema());

    const updatedDocument = reducer(document, proceed(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("PROCEED");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle proceedWithError operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ProceedWithErrorInputSchema());

    const updatedDocument = reducer(document, proceedWithError(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "PROCEED_WITH_ERROR",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
