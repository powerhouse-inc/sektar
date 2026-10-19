/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { InvoiceGlobalState } from "../types.js";
import type { SetInvoiceDetailsAction } from "./actions.js";

export interface InvoiceDetailsOperations {
  setInvoiceDetailsOperation: (
    state: InvoiceGlobalState,
    action: SetInvoiceDetailsAction,
    dispatch?: SignalDispatch,
  ) => void;
}
