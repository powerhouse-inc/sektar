/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  RemoveVatReasonInputSchema,
  SetVatReasonInputSchema,
} from "../schema/zod.js";
import type { RemoveVatReasonInput, SetVatReasonInput } from "../types.js";
import type { RemoveVatReasonAction, SetVatReasonAction } from "./actions.js";

export const setVatReason = (input: SetVatReasonInput) =>
  createAction<SetVatReasonAction>(
    "SET_VAT_REASON",
    { ...input },
    undefined,
    SetVatReasonInputSchema,
    "global",
  );

export const removeVatReason = (input: RemoveVatReasonInput) =>
  createAction<RemoveVatReasonAction>(
    "REMOVE_VAT_REASON",
    { ...input },
    undefined,
    RemoveVatReasonInputSchema,
    "global",
  );
