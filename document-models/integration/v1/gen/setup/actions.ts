/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  InitializeInput,
  SetAccessInput,
  SetCalendarSourceInput,
  SetEmailSourceInput,
  SetTransactionsSourceInput,
} from "../types.js";

export type InitializeAction = Action & {
  type: "INITIALIZE";
  input: InitializeInput;
};
export type SetAccessAction = Action & {
  type: "SET_ACCESS";
  input: SetAccessInput;
};
export type SetCalendarSourceAction = Action & {
  type: "SET_CALENDAR_SOURCE";
  input: SetCalendarSourceInput;
};
export type SetEmailSourceAction = Action & {
  type: "SET_EMAIL_SOURCE";
  input: SetEmailSourceInput;
};
export type SetTransactionsSourceAction = Action & {
  type: "SET_TRANSACTIONS_SOURCE";
  input: SetTransactionsSourceInput;
};

export type IntegrationSetupAction =
  | InitializeAction
  | SetAccessAction
  | SetCalendarSourceAction
  | SetEmailSourceAction
  | SetTransactionsSourceAction;
