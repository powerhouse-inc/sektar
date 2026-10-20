/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { SetBuyerInputSchema, SetSellerInputSchema } from "../schema/zod.js";
import type { SetBuyerInput, SetSellerInput } from "../types.js";
import type { SetBuyerAction, SetSellerAction } from "./actions.js";

export const setSeller = (input: SetSellerInput) =>
  createAction<SetSellerAction>(
    "SET_SELLER",
    { ...input },
    undefined,
    SetSellerInputSchema,
    "global",
  );

export const setBuyer = (input: SetBuyerInput) =>
  createAction<SetBuyerAction>(
    "SET_BUYER",
    { ...input },
    undefined,
    SetBuyerInputSchema,
    "global",
  );
