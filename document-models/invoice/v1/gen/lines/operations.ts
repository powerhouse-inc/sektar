/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { InvoiceGlobalState } from "../types.js";
import type {
  AddLineAction,
  RemoveLineAction,
  UpdateLineAction,
} from "./actions.js";

export interface InvoiceLinesOperations {
  addLineOperation: (
    state: InvoiceGlobalState,
    action: AddLineAction,
    dispatch?: SignalDispatch,
  ) => void;
  updateLineOperation: (
    state: InvoiceGlobalState,
    action: UpdateLineAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeLineOperation: (
    state: InvoiceGlobalState,
    action: RemoveLineAction,
    dispatch?: SignalDispatch,
  ) => void;
}
