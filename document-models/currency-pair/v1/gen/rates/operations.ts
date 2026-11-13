/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { CurrencyPairGlobalState } from "../types.js";
import type {
  RecordRatesAction,
  RemoveRateAction,
  SetManualRateAction,
} from "./actions.js";

export interface CurrencyPairRatesOperations {
  recordRatesOperation: (
    state: CurrencyPairGlobalState,
    action: RecordRatesAction,
    dispatch?: SignalDispatch,
  ) => void;
  setManualRateOperation: (
    state: CurrencyPairGlobalState,
    action: SetManualRateAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeRateOperation: (
    state: CurrencyPairGlobalState,
    action: RemoveRateAction,
    dispatch?: SignalDispatch,
  ) => void;
}
