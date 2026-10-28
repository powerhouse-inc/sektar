/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  InitializeInput,
  SetAccessInput,
  SetCalendarSourceInput,
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

export type IntegrationSetupAction =
  | InitializeAction
  | SetAccessAction
  | SetCalendarSourceAction;
