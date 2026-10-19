/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AssignTaskInput,
  CreateTaskInput,
  SetTaskDescriptionInput,
  SetTaskStatusInput,
} from "../types.js";

export type CreateTaskAction = Action & {
  type: "CREATE_TASK";
  input: CreateTaskInput;
};
export type SetTaskStatusAction = Action & {
  type: "SET_TASK_STATUS";
  input: SetTaskStatusInput;
};
export type AssignTaskAction = Action & {
  type: "ASSIGN_TASK";
  input: AssignTaskInput;
};
export type SetTaskDescriptionAction = Action & {
  type: "SET_TASK_DESCRIPTION";
  input: SetTaskDescriptionInput;
};

export type OriginalSourceCollectionTasksAction =
  | CreateTaskAction
  | SetTaskStatusAction
  | AssignTaskAction
  | SetTaskDescriptionAction;
