/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { RemoveVatReasonInput, SetVatReasonInput } from "../types.js";

export type SetVatReasonAction = Action & {
  type: "SET_VAT_REASON";
  input: SetVatReasonInput;
};
export type RemoveVatReasonAction = Action & {
  type: "REMOVE_VAT_REASON";
  input: RemoveVatReasonInput;
};

export type InvoiceVatAction = SetVatReasonAction | RemoveVatReasonAction;
