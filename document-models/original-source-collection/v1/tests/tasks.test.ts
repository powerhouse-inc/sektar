import { generateMock } from "document-model/mock";
import {
  assignTask,
  AssignTaskInputSchema,
  createTask,
  CreateTaskInputSchema,
  isOriginalSourceCollectionDocument,
  reducer,
  setTaskDescription,
  SetTaskDescriptionInputSchema,
  setTaskStatus,
  SetTaskStatusInputSchema,
  utils,
} from "document-models/original-source-collection/v1";
import { describe, expect, it } from "vitest";

describe("TasksOperations", () => {
  it("should handle createTask operation", () => {
    const document = utils.createDocument();
    const input = generateMock(CreateTaskInputSchema(), {
      createdAt: "2024-01-01T00:00:00.000Z",
    });

    const updatedDocument = reducer(document, createTask(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "CREATE_TASK",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setTaskStatus operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetTaskStatusInputSchema());

    const updatedDocument = reducer(document, setTaskStatus(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_TASK_STATUS",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle assignTask operation", () => {
    const document = utils.createDocument();
    const input = generateMock(AssignTaskInputSchema());

    const updatedDocument = reducer(document, assignTask(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "ASSIGN_TASK",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });

  it("should handle setTaskDescription operation", () => {
    const document = utils.createDocument();
    const input = generateMock(SetTaskDescriptionInputSchema());

    const updatedDocument = reducer(document, setTaskDescription(input));

    expect(isOriginalSourceCollectionDocument(updatedDocument)).toBe(true);
    expect(updatedDocument.operations.global).toHaveLength(1);
    expect(updatedDocument.operations.global[0].action.type).toBe(
      "SET_TASK_DESCRIPTION",
    );
    expect(updatedDocument.operations.global[0].action.input).toStrictEqual(
      input,
    );
    expect(updatedDocument.operations.global[0].index).toEqual(0);
  });
});
