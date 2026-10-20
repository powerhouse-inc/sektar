/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { TripGlobalState } from "../types.js";
import type {
  AddTransportAction,
  RemoveTransportAction,
  UpdateTransportAction,
} from "./actions.js";

export interface TripTransportOperations {
  addTransportOperation: (
    state: TripGlobalState,
    action: AddTransportAction,
    dispatch?: SignalDispatch,
  ) => void;
  updateTransportOperation: (
    state: TripGlobalState,
    action: UpdateTransportAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeTransportOperation: (
    state: TripGlobalState,
    action: RemoveTransportAction,
    dispatch?: SignalDispatch,
  ) => void;
}
