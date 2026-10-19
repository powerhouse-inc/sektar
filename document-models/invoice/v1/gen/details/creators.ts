/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import { SetInvoiceDetailsInputSchema } from "../schema/zod.js";
import type { SetInvoiceDetailsInput } from "../types.js";
import type { SetInvoiceDetailsAction } from "./actions.js";

export const setInvoiceDetails = (input: SetInvoiceDetailsInput) =>
  createAction<SetInvoiceDetailsAction>(
    "SET_INVOICE_DETAILS",
    { ...input },
    undefined,
    SetInvoiceDetailsInputSchema,
    "global",
  );
