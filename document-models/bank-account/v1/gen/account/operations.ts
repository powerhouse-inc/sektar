/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { BankAccountGlobalState } from "../types.js";
import type {
  CorrectCurrencyAction,
  SetAccountDetailsAction,
} from "./actions.js";

export interface BankAccountAccountOperations {
  setAccountDetailsOperation: (
    state: BankAccountGlobalState,
    action: SetAccountDetailsAction,
    dispatch?: SignalDispatch,
  ) => void;
  correctCurrencyOperation: (
    state: BankAccountGlobalState,
    action: CorrectCurrencyAction,
    dispatch?: SignalDispatch,
  ) => void;
}
