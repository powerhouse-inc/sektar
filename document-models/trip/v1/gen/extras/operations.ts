/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { TripGlobalState } from "../types.js";
import type {
  AddExtraAction,
  RemoveExtraAction,
  UpdateExtraAction,
} from "./actions.js";

export interface TripExtrasOperations {
  addExtraOperation: (
    state: TripGlobalState,
    action: AddExtraAction,
    dispatch?: SignalDispatch,
  ) => void;
  updateExtraOperation: (
    state: TripGlobalState,
    action: UpdateExtraAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeExtraOperation: (
    state: TripGlobalState,
    action: RemoveExtraAction,
    dispatch?: SignalDispatch,
  ) => void;
}
