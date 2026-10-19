/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AssignTaskInputSchema,
  CreateTaskInputSchema,
  SetTaskDescriptionInputSchema,
  SetTaskStatusInputSchema,
} from "../schema/zod.js";
import type {
  AssignTaskInput,
  CreateTaskInput,
  SetTaskDescriptionInput,
  SetTaskStatusInput,
} from "../types.js";
import type {
  AssignTaskAction,
  CreateTaskAction,
  SetTaskDescriptionAction,
  SetTaskStatusAction,
} from "./actions.js";

export const createTask = (input: CreateTaskInput) =>
  createAction<CreateTaskAction>(
    "CREATE_TASK",
    { ...input },
    undefined,
    CreateTaskInputSchema,
    "global",
  );

export const setTaskStatus = (input: SetTaskStatusInput) =>
  createAction<SetTaskStatusAction>(
    "SET_TASK_STATUS",
    { ...input },
    undefined,
    SetTaskStatusInputSchema,
    "global",
  );

export const assignTask = (input: AssignTaskInput) =>
  createAction<AssignTaskAction>(
    "ASSIGN_TASK",
    { ...input },
    undefined,
    AssignTaskInputSchema,
    "global",
  );

export const setTaskDescription = (input: SetTaskDescriptionInput) =>
  createAction<SetTaskDescriptionAction>(
    "SET_TASK_DESCRIPTION",
    { ...input },
    undefined,
    SetTaskDescriptionInputSchema,
    "global",
  );
