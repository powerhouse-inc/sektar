/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddDateRangeBackfillInputSchema,
  SetBackfillEnabledInputSchema,
} from "../schema/zod.js";
import type {
  AddDateRangeBackfillInput,
  SetBackfillEnabledInput,
} from "../types.js";
import type {
  AddDateRangeBackfillAction,
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
