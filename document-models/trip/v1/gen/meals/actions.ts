/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddMealInput,
  RemoveMealInput,
  UpdateMealInput,
} from "../types.js";

export type AddMealAction = Action & { type: "ADD_MEAL"; input: AddMealInput };
export type UpdateMealAction = Action & {
  type: "UPDATE_MEAL";
  input: UpdateMealInput;
};
export type RemoveMealAction = Action & {
  type: "REMOVE_MEAL";
  input: RemoveMealInput;
};

export type TripMealsAction =
  | AddMealAction
  | UpdateMealAction
  | RemoveMealAction;
