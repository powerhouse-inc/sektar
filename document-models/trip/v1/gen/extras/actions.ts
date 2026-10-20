/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddExtraInput,
  RemoveExtraInput,
  UpdateExtraInput,
} from "../types.js";

export type AddExtraAction = Action & {
  type: "ADD_EXTRA";
  input: AddExtraInput;
};
export type UpdateExtraAction = Action & {
  type: "UPDATE_EXTRA";
  input: UpdateExtraInput;
};
export type RemoveExtraAction = Action & {
  type: "REMOVE_EXTRA";
  input: RemoveExtraInput;
};

export type TripExtrasAction =
  | AddExtraAction
  | UpdateExtraAction
  | RemoveExtraAction;
