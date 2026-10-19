import { generateMock } from "document-model/mock";
import {
  isOriginalSourceQueueDocument,
  pause,
  PauseInputSchema,
  reducer,
  reset,
  ResetInputSchema,
  start,
  StartInputSchema,
  terminate,
  TerminateInputSchema,
  unpause,
  UnpauseInputSchema,
  utils,
} from "document-models/original-source-queue/v1";
import { describe, expect, it } from "vitest";

describe("LifecycleOperations", () => {
  it("should handle start operation", () => {
    const document = utils.createDocument();
    const input = generateMock(StartInputSchema());

    const updatedDocument = reducer(document, start(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("START");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle pause operation", () => {
    const document = utils.createDocument();
    const input = generateMock(PauseInputSchema());

    const updatedDocument = reducer(document, pause(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("PAUSE");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle unpause operation", () => {
    const document = utils.createDocument();
    const input = generateMock(UnpauseInputSchema());

    const updatedDocument = reducer(document, unpause(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("UNPAUSE");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle reset operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ResetInputSchema());

    const updatedDocument = reducer(document, reset(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("RESET");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle terminate operation", () => {
    const document = utils.createDocument();
    const input = generateMock(TerminateInputSchema());

    const updatedDocument = reducer(document, terminate(input));

    expect(isOriginalSourceQueueDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("TERMINATE");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
