/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { SetPaymentInstructionsInputSchema } from "../schema/zod.js";
import type { SetPaymentInstructionsInput } from "../types.js";
import type { SetPaymentInstructionsAction } from "./actions.js";

export const setPaymentInstructions = (input: SetPaymentInstructionsInput) =>
  createAction<SetPaymentInstructionsAction>(
    "SET_PAYMENT_INSTRUCTIONS",
    { ...input },
    undefined,
    SetPaymentInstructionsInputSchema,
    "global",
  );
