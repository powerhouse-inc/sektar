/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { InvoiceGlobalState } from "../types.js";
import type { SetPaymentInstructionsAction } from "./actions.js";

export interface InvoicePaymentOperations {
  setPaymentInstructionsOperation: (
    state: InvoiceGlobalState,
    action: SetPaymentInstructionsAction,
    dispatch?: SignalDispatch,
  ) => void;
}
