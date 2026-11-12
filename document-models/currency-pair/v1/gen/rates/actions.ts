/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  RecordRatesInput,
  RemoveRateInput,
  SetManualRateInput,
} from "../types.js";

export type RecordRatesAction = Action & {
  type: "RECORD_RATES";
  input: RecordRatesInput;
};
export type SetManualRateAction = Action & {
  type: "SET_MANUAL_RATE";
  input: SetManualRateInput;
};
export type RemoveRateAction = Action & {
  type: "REMOVE_RATE";
  input: RemoveRateInput;
};

export type CurrencyPairRatesAction =
  | RecordRatesAction
  | SetManualRateAction
  | RemoveRateAction;
