/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddStayInput,
  RemoveStayInput,
  UpdateStayInput,
} from "../types.js";

export type AddStayAction = Action & { type: "ADD_STAY"; input: AddStayInput };
export type UpdateStayAction = Action & {
  type: "UPDATE_STAY";
  input: UpdateStayInput;
};
export type RemoveStayAction = Action & {
  type: "REMOVE_STAY";
  input: RemoveStayInput;
};

export type TripStaysAction =
  | AddStayAction
  | UpdateStayAction
  | RemoveStayAction;
