/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { OriginalSourceCollectionGlobalState } from "../types.js";
import type {
  AssignTaskAction,
  CreateTaskAction,
  SetTaskDescriptionAction,
  SetTaskStatusAction,
} from "./actions.js";

export interface OriginalSourceCollectionTasksOperations {
  createTaskOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: CreateTaskAction,
    dispatch?: SignalDispatch,
  ) => void;
  setTaskStatusOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: SetTaskStatusAction,
    dispatch?: SignalDispatch,
  ) => void;
  assignTaskOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: AssignTaskAction,
    dispatch?: SignalDispatch,
  ) => void;
  setTaskDescriptionOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: SetTaskDescriptionAction,
    dispatch?: SignalDispatch,
  ) => void;
}
