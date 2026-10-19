/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { InvoiceGlobalState } from "../types.js";
import type {
  IssueInvoiceAction,
  RecordPaymentAction,
  VoidInvoiceAction,
} from "./actions.js";

export interface InvoiceLifecycleOperations {
  issueInvoiceOperation: (
    state: InvoiceGlobalState,
    action: IssueInvoiceAction,
    dispatch?: SignalDispatch,
  ) => void;
  recordPaymentOperation: (
    state: InvoiceGlobalState,
    action: RecordPaymentAction,
    dispatch?: SignalDispatch,
  ) => void;
  voidInvoiceOperation: (
    state: InvoiceGlobalState,
    action: VoidInvoiceAction,
    dispatch?: SignalDispatch,
  ) => void;
}
