/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { TripGlobalState } from "../types.js";
import type {
  AddStayAction,
  RemoveStayAction,
  UpdateStayAction,
} from "./actions.js";

export interface TripStaysOperations {
  addStayOperation: (
    state: TripGlobalState,
    action: AddStayAction,
    dispatch?: SignalDispatch,
  ) => void;
  updateStayOperation: (
    state: TripGlobalState,
    action: UpdateStayAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeStayOperation: (
    state: TripGlobalState,
    action: RemoveStayAction,
    dispatch?: SignalDispatch,
  ) => void;
}
