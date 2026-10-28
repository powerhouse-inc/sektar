/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  AddDateRangeBackfillInputSchema,
  AttachBackfillInputSchema,
  RemoveBackfillInputSchema,
  SetBackfillEnabledInputSchema,
} from "../schema/zod.js";
import type {
  AddDateRangeBackfillInput,
  AttachBackfillInput,
  RemoveBackfillInput,
  SetBackfillEnabledInput,
} from "../types.js";
import type {
  AddDateRangeBackfillAction,
  AttachBackfillAction,
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

export const attachBackfill = (input: AttachBackfillInput) =>
  createAction<AttachBackfillAction>(
    "ATTACH_BACKFILL",
    { ...input },
    undefined,
    AttachBackfillInputSchema,
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
