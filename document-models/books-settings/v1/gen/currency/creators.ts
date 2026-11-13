/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { SetBaseCurrencyInputSchema } from "../schema/zod.js";
import type { SetBaseCurrencyInput } from "../types.js";
import type { SetBaseCurrencyAction } from "./actions.js";

export const setBaseCurrency = (input: SetBaseCurrencyInput) =>
  createAction<SetBaseCurrencyAction>(
    "SET_BASE_CURRENCY",
    { ...input },
    undefined,
    SetBaseCurrencyInputSchema,
    "global",
  );
