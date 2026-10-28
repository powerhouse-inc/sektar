/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { InitializeInput, SetCalendarSourceInput } from "../types.js";

export type InitializeAction = Action & {
  type: "INITIALIZE";
  input: InitializeInput;
};
export type SetCalendarSourceAction = Action & {
  type: "SET_CALENDAR_SOURCE";
  input: SetCalendarSourceInput;
};

export type IntegrationSetupAction = InitializeAction | SetCalendarSourceAction;
