import { generateMock } from "document-model/mock";
import {
  isFolderSyncDocument,
  reducer,
  requestPull,
  RequestPullInputSchema,
  requestSync,
  RequestSyncInputSchema,
  utils,
} from "document-models/folder-sync/v1";
import { describe, expect, it } from "vitest";

describe("SyncOperations", () => {
  it("should handle requestSync operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RequestSyncInputSchema(), {
      requestedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, requestSync(input));

    expect(isFolderSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REQUEST_SYNC",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle requestPull operation", () => {
    const document = utils.createDocument();
    const input = generateMock(RequestPullInputSchema(), {
      requestedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, requestPull(input));

    expect(isFolderSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "REQUEST_PULL",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
