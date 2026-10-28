/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { SetLiveEnabledInput, SetLiveIntervalInput } from "../types.js";

export type SetLiveEnabledAction = Action & {
  type: "SET_LIVE_ENABLED";
  input: SetLiveEnabledInput;
};
export type SetLiveIntervalAction = Action & {
  type: "SET_LIVE_INTERVAL";
  input: SetLiveIntervalInput;
};

export type IntegrationLiveAction =
  | SetLiveEnabledAction
  | SetLiveIntervalAction;
