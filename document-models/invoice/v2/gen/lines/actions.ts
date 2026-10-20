/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddLineInput,
  MoveLineInput,
  RemoveLineInput,
  UpdateLineInput,
} from "../types.js";

export type AddLineAction = Action & { type: "ADD_LINE"; input: AddLineInput };
export type UpdateLineAction = Action & {
  type: "UPDATE_LINE";
  input: UpdateLineInput;
};
export type RemoveLineAction = Action & {
  type: "REMOVE_LINE";
  input: RemoveLineInput;
};
export type MoveLineAction = Action & {
  type: "MOVE_LINE";
  input: MoveLineInput;
};

export type InvoiceLinesAction =
  | AddLineAction
  | UpdateLineAction
  | RemoveLineAction
  | MoveLineAction;
