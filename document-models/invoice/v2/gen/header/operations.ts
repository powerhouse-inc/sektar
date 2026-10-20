/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { InvoiceGlobalState } from "../types.js";
import type {
  AddPrecedingInvoiceAction,
  RemovePrecedingInvoiceAction,
  SetHeaderAction,
} from "./actions.js";

export interface InvoiceHeaderOperations {
  setHeaderOperation: (
    state: InvoiceGlobalState,
    action: SetHeaderAction,
    dispatch?: SignalDispatch,
  ) => void;
  addPrecedingInvoiceOperation: (
    state: InvoiceGlobalState,
    action: AddPrecedingInvoiceAction,
    dispatch?: SignalDispatch,
  ) => void;
  removePrecedingInvoiceOperation: (
    state: InvoiceGlobalState,
    action: RemovePrecedingInvoiceAction,
    dispatch?: SignalDispatch,
  ) => void;
}
