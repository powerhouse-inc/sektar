/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { SetAccountDetailsInputSchema } from "../schema/zod.js";
import type { SetAccountDetailsInput } from "../types.js";
import type { SetAccountDetailsAction } from "./actions.js";

export const setAccountDetails = (input: SetAccountDetailsInput) =>
  createAction<SetAccountDetailsAction>(
    "SET_ACCOUNT_DETAILS",
    { ...input },
    undefined,
    SetAccountDetailsInputSchema,
    "global",
  );
