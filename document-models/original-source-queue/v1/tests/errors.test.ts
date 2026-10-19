import { generateMock } from "document-model/mock";
import {
  isOriginalSourceQueueDocument,
  reducer,
  reportError,
  ReportErrorInputSchema,
  utils,
} from "document-models/original-source-queue/v1";
import { describe, expect, it } from "vitest";

describe("ErrorsOperations", () => {
  it("should handle reportError operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ReportErrorInputSchema());

    const updatedDocument = reducer(document, reportError(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REPORT_ERROR",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
