/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddTransportInput,
  RemoveTransportInput,
  UpdateTransportInput,
} from "../types.js";

export type AddTransportAction = Action & {
  type: "ADD_TRANSPORT";
  input: AddTransportInput;
};
export type UpdateTransportAction = Action & {
  type: "UPDATE_TRANSPORT";
  input: UpdateTransportInput;
};
export type RemoveTransportAction = Action & {
  type: "REMOVE_TRANSPORT";
  input: RemoveTransportInput;
};

export type TripTransportAction =
  | AddTransportAction
  | UpdateTransportAction
  | RemoveTransportAction;
