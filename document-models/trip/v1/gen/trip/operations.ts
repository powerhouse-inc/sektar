/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { TripGlobalState } from "../types.js";
import type {
  AddDestinationAction,
  RemoveDestinationAction,
  SetBillingAction,
  SetDetailsAction,
  SetStatusAction,
  SetTravelerAction,
  UpdateDestinationAction,
} from "./actions.js";

export interface TripTripOperations {
  setDetailsOperation: (
    state: TripGlobalState,
    action: SetDetailsAction,
    dispatch?: SignalDispatch,
  ) => void;
  setStatusOperation: (
    state: TripGlobalState,
    action: SetStatusAction,
    dispatch?: SignalDispatch,
  ) => void;
  setTravelerOperation: (
    state: TripGlobalState,
    action: SetTravelerAction,
    dispatch?: SignalDispatch,
  ) => void;
  setBillingOperation: (
    state: TripGlobalState,
    action: SetBillingAction,
    dispatch?: SignalDispatch,
  ) => void;
  addDestinationOperation: (
    state: TripGlobalState,
    action: AddDestinationAction,
    dispatch?: SignalDispatch,
  ) => void;
  updateDestinationOperation: (
    state: TripGlobalState,
    action: UpdateDestinationAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeDestinationOperation: (
    state: TripGlobalState,
    action: RemoveDestinationAction,
    dispatch?: SignalDispatch,
  ) => void;
}
