/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { SetPaymentInstructionsInput } from "../types.js";

export type SetPaymentInstructionsAction = Action & {
  type: "SET_PAYMENT_INSTRUCTIONS";
  input: SetPaymentInstructionsInput;
};

export type InvoicePaymentAction = SetPaymentInstructionsAction;
