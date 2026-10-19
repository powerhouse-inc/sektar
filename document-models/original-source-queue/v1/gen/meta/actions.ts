/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  SetCursorDescriptionInput,
  SetDescriptionInput,
} from "../types.js";

export type SetDescriptionAction = Action & {
  type: "SET_DESCRIPTION";
  input: SetDescriptionInput;
};
export type SetCursorDescriptionAction = Action & {
  type: "SET_CURSOR_DESCRIPTION";
  input: SetCursorDescriptionInput;
};

export type OriginalSourceQueueMetaAction =
  | SetDescriptionAction
  | SetCursorDescriptionAction;
