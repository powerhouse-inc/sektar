/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddCollectionValueInput,
  ClearCollectionInput,
} from "../types.js";

export type AddCollectionValueAction = Action & {
  type: "ADD_COLLECTION_VALUE";
  input: AddCollectionValueInput;
};
export type ClearCollectionAction = Action & {
  type: "CLEAR_COLLECTION";
  input: ClearCollectionInput;
};

export type OriginalSourceQueueCollectionsAction =
  | AddCollectionValueAction
  | ClearCollectionAction;
