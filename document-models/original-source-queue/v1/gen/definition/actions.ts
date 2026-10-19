/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  CreateCollectionCursorInput,
  CreateCollectionInput,
  CreateDateTimeCursorInput,
  CreateNumberCursorInput,
  ReorderCursorsInput,
  SetCursorNameInput,
} from "../types.js";

export type CreateDateTimeCursorAction = Action & {
  type: "CREATE_DATE_TIME_CURSOR";
  input: CreateDateTimeCursorInput;
};
export type CreateNumberCursorAction = Action & {
  type: "CREATE_NUMBER_CURSOR";
  input: CreateNumberCursorInput;
};
export type CreateCollectionCursorAction = Action & {
  type: "CREATE_COLLECTION_CURSOR";
  input: CreateCollectionCursorInput;
};
export type ReorderCursorsAction = Action & {
  type: "REORDER_CURSORS";
  input: ReorderCursorsInput;
};
export type SetCursorNameAction = Action & {
  type: "SET_CURSOR_NAME";
  input: SetCursorNameInput;
};
export type CreateCollectionAction = Action & {
  type: "CREATE_COLLECTION";
  input: CreateCollectionInput;
};

export type OriginalSourceQueueDefinitionAction =
  | CreateDateTimeCursorAction
  | CreateNumberCursorAction
  | CreateCollectionCursorAction
  | ReorderCursorsAction
  | SetCursorNameAction
  | CreateCollectionAction;
