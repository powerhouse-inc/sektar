/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  IssueInvoiceInput,
  RecordPaymentInput,
  RemovePaymentInput,
  VoidInvoiceInput,
} from "../types.js";

export type IssueInvoiceAction = Action & {
  type: "ISSUE_INVOICE";
  input: IssueInvoiceInput;
};
export type RecordPaymentAction = Action & {
  type: "RECORD_PAYMENT";
  input: RecordPaymentInput;
};
export type RemovePaymentAction = Action & {
  type: "REMOVE_PAYMENT";
  input: RemovePaymentInput;
};
export type VoidInvoiceAction = Action & {
  type: "VOID_INVOICE";
  input: VoidInvoiceInput;
};

export type InvoiceLifecycleAction =
  | IssueInvoiceAction
  | RecordPaymentAction
  | RemovePaymentAction
  | VoidInvoiceAction;
