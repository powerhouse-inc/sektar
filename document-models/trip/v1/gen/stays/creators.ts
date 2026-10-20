/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddStayInputSchema,
  RemoveStayInputSchema,
  UpdateStayInputSchema,
} from "../schema/zod.js";
import type {
  AddStayInput,
  RemoveStayInput,
  UpdateStayInput,
} from "../types.js";
import type {
  AddStayAction,
  RemoveStayAction,
  UpdateStayAction,
} from "./actions.js";

export const addStay = (input: AddStayInput) =>
  createAction<AddStayAction>(
    "ADD_STAY",
    { ...input },
    undefined,
    AddStayInputSchema,
    "global",
  );

export const updateStay = (input: UpdateStayInput) =>
  createAction<UpdateStayAction>(
    "UPDATE_STAY",
    { ...input },
    undefined,
    UpdateStayInputSchema,
    "global",
  );

export const removeStay = (input: RemoveStayInput) =>
  createAction<RemoveStayAction>(
    "REMOVE_STAY",
    { ...input },
    undefined,
    RemoveStayInputSchema,
    "global",
  );
