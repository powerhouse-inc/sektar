/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddMealInputSchema,
  RemoveMealInputSchema,
  UpdateMealInputSchema,
} from "../schema/zod.js";
import type {
  AddMealInput,
  RemoveMealInput,
  UpdateMealInput,
} from "../types.js";
import type {
  AddMealAction,
  RemoveMealAction,
  UpdateMealAction,
} from "./actions.js";

export const addMeal = (input: AddMealInput) =>
  createAction<AddMealAction>(
    "ADD_MEAL",
    { ...input },
    undefined,
    AddMealInputSchema,
    "global",
  );

export const updateMeal = (input: UpdateMealInput) =>
  createAction<UpdateMealAction>(
    "UPDATE_MEAL",
    { ...input },
    undefined,
    UpdateMealInputSchema,
    "global",
  );

export const removeMeal = (input: RemoveMealInput) =>
  createAction<RemoveMealAction>(
    "REMOVE_MEAL",
    { ...input },
    undefined,
    RemoveMealInputSchema,
    "global",
  );
