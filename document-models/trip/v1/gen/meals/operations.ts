/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { TripGlobalState } from "../types.js";
import type {
  AddMealAction,
  RemoveMealAction,
  UpdateMealAction,
} from "./actions.js";

export interface TripMealsOperations {
  addMealOperation: (
    state: TripGlobalState,
    action: AddMealAction,
    dispatch?: SignalDispatch,
  ) => void;
  updateMealOperation: (
    state: TripGlobalState,
    action: UpdateMealAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeMealOperation: (
    state: TripGlobalState,
    action: RemoveMealAction,
    dispatch?: SignalDispatch,
  ) => void;
}
