/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { CorrectCurrencyInput, SetAccountDetailsInput } from "../types.js";

export type SetAccountDetailsAction = Action & {
  type: "SET_ACCOUNT_DETAILS";
  input: SetAccountDetailsInput;
};
export type CorrectCurrencyAction = Action & {
  type: "CORRECT_CURRENCY";
  input: CorrectCurrencyInput;
};

export type BankAccountAccountAction =
  | SetAccountDetailsAction
  | CorrectCurrencyAction;
