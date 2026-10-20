/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  RemoveExchangeRateInputSchema,
  SetCurrencyInputSchema,
  SetExchangeRateInputSchema,
} from "../schema/zod.js";
import type {
  RemoveExchangeRateInput,
  SetCurrencyInput,
  SetExchangeRateInput,
} from "../types.js";
import type {
  RemoveExchangeRateAction,
  SetCurrencyAction,
  SetExchangeRateAction,
} from "./actions.js";

export const setCurrency = (input: SetCurrencyInput) =>
  createAction<SetCurrencyAction>(
    "SET_CURRENCY",
    { ...input },
    undefined,
    SetCurrencyInputSchema,
    "global",
  );

export const setExchangeRate = (input: SetExchangeRateInput) =>
  createAction<SetExchangeRateAction>(
    "SET_EXCHANGE_RATE",
    { ...input },
    undefined,
    SetExchangeRateInputSchema,
    "global",
  );

export const removeExchangeRate = (input: RemoveExchangeRateInput) =>
  createAction<RemoveExchangeRateAction>(
    "REMOVE_EXCHANGE_RATE",
    { ...input },
    undefined,
    RemoveExchangeRateInputSchema,
    "global",
  );
