/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddDestinationInput,
  RemoveDestinationInput,
  SetBillingInput,
  SetDetailsInput,
  SetStatusInput,
  SetTravelerInput,
  UpdateDestinationInput,
} from "../types.js";

export type SetDetailsAction = Action & {
  type: "SET_DETAILS";
  input: SetDetailsInput;
};
export type SetStatusAction = Action & {
  type: "SET_STATUS";
  input: SetStatusInput;
};
export type SetTravelerAction = Action & {
  type: "SET_TRAVELER";
  input: SetTravelerInput;
};
export type SetBillingAction = Action & {
  type: "SET_BILLING";
  input: SetBillingInput;
};
export type AddDestinationAction = Action & {
  type: "ADD_DESTINATION";
  input: AddDestinationInput;
};
export type UpdateDestinationAction = Action & {
  type: "UPDATE_DESTINATION";
  input: UpdateDestinationInput;
};
export type RemoveDestinationAction = Action & {
  type: "REMOVE_DESTINATION";
  input: RemoveDestinationInput;
};

export type TripTripAction =
  | SetDetailsAction
  | SetStatusAction
  | SetTravelerAction
  | SetBillingAction
  | AddDestinationAction
  | UpdateDestinationAction
  | RemoveDestinationAction;
