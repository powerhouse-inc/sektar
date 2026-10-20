/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { InvoiceGlobalState } from "../types.js";
import type { SetBuyerAction, SetSellerAction } from "./actions.js";

export interface InvoicePartiesOperations {
  setSellerOperation: (
    state: InvoiceGlobalState,
    action: SetSellerAction,
    dispatch?: SignalDispatch,
  ) => void;
  setBuyerOperation: (
    state: InvoiceGlobalState,
    action: SetBuyerAction,
    dispatch?: SignalDispatch,
  ) => void;
}
