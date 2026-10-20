/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddPrecedingInvoiceInput,
  RemovePrecedingInvoiceInput,
  SetHeaderInput,
} from "../types.js";

export type SetHeaderAction = Action & {
  type: "SET_HEADER";
  input: SetHeaderInput;
};
export type AddPrecedingInvoiceAction = Action & {
  type: "ADD_PRECEDING_INVOICE";
  input: AddPrecedingInvoiceInput;
};
export type RemovePrecedingInvoiceAction = Action & {
  type: "REMOVE_PRECEDING_INVOICE";
  input: RemovePrecedingInvoiceInput;
};

export type InvoiceHeaderAction =
  | SetHeaderAction
  | AddPrecedingInvoiceAction
  | RemovePrecedingInvoiceAction;
