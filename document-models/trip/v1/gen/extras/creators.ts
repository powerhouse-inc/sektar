/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddExtraInputSchema,
  RemoveExtraInputSchema,
  UpdateExtraInputSchema,
} from "../schema/zod.js";
import type {
  AddExtraInput,
  RemoveExtraInput,
  UpdateExtraInput,
} from "../types.js";
import type {
  AddExtraAction,
  RemoveExtraAction,
  UpdateExtraAction,
} from "./actions.js";

export const addExtra = (input: AddExtraInput) =>
  createAction<AddExtraAction>(
    "ADD_EXTRA",
    { ...input },
    undefined,
    AddExtraInputSchema,
    "global",
  );

export const updateExtra = (input: UpdateExtraInput) =>
  createAction<UpdateExtraAction>(
    "UPDATE_EXTRA",
    { ...input },
    undefined,
    UpdateExtraInputSchema,
    "global",
  );

export const removeExtra = (input: RemoveExtraInput) =>
  createAction<RemoveExtraAction>(
    "REMOVE_EXTRA",
    { ...input },
    undefined,
    RemoveExtraInputSchema,
    "global",
  );
