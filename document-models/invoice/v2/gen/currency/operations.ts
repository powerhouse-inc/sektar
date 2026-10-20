/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { InvoiceGlobalState } from "../types.js";
import type {
  RemoveExchangeRateAction,
  SetCurrencyAction,
  SetExchangeRateAction,
} from "./actions.js";

export interface InvoiceCurrencyOperations {
  setCurrencyOperation: (
    state: InvoiceGlobalState,
    action: SetCurrencyAction,
    dispatch?: SignalDispatch,
  ) => void;
  setExchangeRateOperation: (
    state: InvoiceGlobalState,
    action: SetExchangeRateAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeExchangeRateOperation: (
    state: InvoiceGlobalState,
    action: RemoveExchangeRateAction,
    dispatch?: SignalDispatch,
  ) => void;
}
