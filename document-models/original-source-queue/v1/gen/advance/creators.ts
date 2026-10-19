/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  ProceedInputSchema,
  ProceedWithErrorInputSchema,
} from "../schema/zod.js";
import type { ProceedInput, ProceedWithErrorInput } from "../types.js";
import type { ProceedAction, ProceedWithErrorAction } from "./actions.js";

export const proceed = (input: ProceedInput) =>
  createAction<ProceedAction>(
    "PROCEED",
    { ...input },
    undefined,
    ProceedInputSchema,
    "global",
  );

export const proceedWithError = (input: ProceedWithErrorInput) =>
  createAction<ProceedWithErrorAction>(
    "PROCEED_WITH_ERROR",
    { ...input },
    undefined,
    ProceedWithErrorInputSchema,
    "global",
  );
