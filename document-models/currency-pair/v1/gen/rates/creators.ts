/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  RecordRatesInputSchema,
  RemoveRateInputSchema,
  SetManualRateInputSchema,
} from "../schema/zod.js";
import type {
  RecordRatesInput,
  RemoveRateInput,
  SetManualRateInput,
} from "../types.js";
import type {
  RecordRatesAction,
  RemoveRateAction,
  SetManualRateAction,
} from "./actions.js";

export const recordRates = (input: RecordRatesInput) =>
  createAction<RecordRatesAction>(
    "RECORD_RATES",
    { ...input },
    undefined,
    RecordRatesInputSchema,
    "global",
  );

export const setManualRate = (input: SetManualRateInput) =>
  createAction<SetManualRateAction>(
    "SET_MANUAL_RATE",
    { ...input },
    undefined,
    SetManualRateInputSchema,
    "global",
  );

export const removeRate = (input: RemoveRateInput) =>
  createAction<RemoveRateAction>(
    "REMOVE_RATE",
    { ...input },
    undefined,
    RemoveRateInputSchema,
    "global",
  );
