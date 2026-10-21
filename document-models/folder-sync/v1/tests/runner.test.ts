import { generateMock } from "document-model/mock";
import {
  completePull,
  CompletePullInputSchema,
  finishRun,
  FinishRunInputSchema,
  isFolderSyncDocument,
  reducer,
  resolveIssue,
  ResolveIssueInputSchema,
  setIssues,
  SetIssuesInputSchema,
  startRun,
  StartRunInputSchema,
  utils,
} from "document-models/folder-sync/v1";
import { describe, expect, it } from "vitest";

describe("RunnerOperations", () => {
  it("should handle startRun operation", () => {
    const document = utils.createDocument();
    const input = generateMock(StartRunInputSchema(), {
      startedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, startRun(input));

    expect(isFolderSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("START_RUN");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle finishRun operation", () => {
    const document = utils.createDocument();
    const input = generateMock(FinishRunInputSchema(), {
      finishedAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, finishRun(input));

    expect(isFolderSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("FINISH_RUN");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setIssues operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetIssuesInputSchema());

    const updatedDocument = reducer(document, setIssues(input));

    expect(isFolderSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe("SET_ISSUES");
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle resolveIssue operation", () => {
    const document = utils.createDocument();
    const input = generateMock(ResolveIssueInputSchema());

    const updatedDocument = reducer(document, resolveIssue(input));

    expect(isFolderSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "RESOLVE_ISSUE",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle completePull operation", () => {
    const document = utils.createDocument();
    const input = generateMock(CompletePullInputSchema());

    const updatedDocument = reducer(document, completePull(input));

    expect(isFolderSyncDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "COMPLETE_PULL",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
