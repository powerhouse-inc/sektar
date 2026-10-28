/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddDateRangeBackfillInputSchema,
  RemoveBackfillInputSchema,
  SetBackfillEnabledInputSchema,
} from "../schema/zod.js";
import type {
  AddDateRangeBackfillInput,
  RemoveBackfillInput,
  SetBackfillEnabledInput,
} from "../types.js";
import type {
  AddDateRangeBackfillAction,
  RemoveBackfillAction,
  SetBackfillEnabledAction,
} from "./actions.js";

export const setBackfillEnabled = (input: SetBackfillEnabledInput) =>
  createAction<SetBackfillEnabledAction>(
    "SET_BACKFILL_ENABLED",
    { ...input },
    undefined,
    SetBackfillEnabledInputSchema,
    "global",
  );

export const addDateRangeBackfill = (input: AddDateRangeBackfillInput) =>
  createAction<AddDateRangeBackfillAction>(
    "ADD_DATE_RANGE_BACKFILL",
    { ...input },
    undefined,
    AddDateRangeBackfillInputSchema,
    "global",
  );

export const removeBackfill = (input: RemoveBackfillInput) =>
  createAction<RemoveBackfillAction>(
    "REMOVE_BACKFILL",
    { ...input },
    undefined,
    RemoveBackfillInputSchema,
    "global",
  );
