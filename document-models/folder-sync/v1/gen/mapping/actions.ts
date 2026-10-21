/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  SetEnabledInput,
  SetLocalPathInput,
  SetOptionsInput,
  SetTargetInput,
} from "../types.js";

export type SetTargetAction = Action & {
  type: "SET_TARGET";
  input: SetTargetInput;
};
export type SetLocalPathAction = Action & {
  type: "SET_LOCAL_PATH";
  input: SetLocalPathInput;
};
export type SetOptionsAction = Action & {
  type: "SET_OPTIONS";
  input: SetOptionsInput;
};
export type SetEnabledAction = Action & {
  type: "SET_ENABLED";
  input: SetEnabledInput;
};

export type FolderSyncMappingAction =
  | SetTargetAction
  | SetLocalPathAction
  | SetOptionsAction
  | SetEnabledAction;
