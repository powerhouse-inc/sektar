import { generateMock } from "document-model/mock";
import {
  isOriginalSourceQueueDocument,
  reducer,
  updateMemory,
  UpdateMemoryInputSchema,
  utils,
} from "document-models/original-source-queue/v1";
import { describe, expect, it } from "vitest";

describe("MemoryOperations", () => {
  it("should handle updateMemory operation", () => {
    const document = utils.createDocument();
    const input = generateMock(UpdateMemoryInputSchema());

    const updatedDocument = reducer(document, updateMemory(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "UPDATE_MEMORY",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
