/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { InvoiceGlobalState } from "../types.js";
import type { RemoveVatReasonAction, SetVatReasonAction } from "./actions.js";

export interface InvoiceVatOperations {
  setVatReasonOperation: (
    state: InvoiceGlobalState,
    action: SetVatReasonAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeVatReasonOperation: (
    state: InvoiceGlobalState,
    action: RemoveVatReasonAction,
    dispatch?: SignalDispatch,
  ) => void;
}
