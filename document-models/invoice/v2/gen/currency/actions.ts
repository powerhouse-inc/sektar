/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  RemoveExchangeRateInput,
  SetCurrencyInput,
  SetExchangeRateInput,
} from "../types.js";

export type SetCurrencyAction = Action & {
  type: "SET_CURRENCY";
  input: SetCurrencyInput;
};
export type SetExchangeRateAction = Action & {
  type: "SET_EXCHANGE_RATE";
  input: SetExchangeRateInput;
};
export type RemoveExchangeRateAction = Action & {
  type: "REMOVE_EXCHANGE_RATE";
  input: RemoveExchangeRateInput;
};

export type InvoiceCurrencyAction =
  | SetCurrencyAction
  | SetExchangeRateAction
  | RemoveExchangeRateAction;
