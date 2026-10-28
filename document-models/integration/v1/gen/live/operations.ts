/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { IntegrationGlobalState } from "../types.js";
import type { SetLiveEnabledAction, SetLiveIntervalAction } from "./actions.js";

export interface IntegrationLiveOperations {
  setLiveEnabledOperation: (
    state: IntegrationGlobalState,
    action: SetLiveEnabledAction,
    dispatch?: SignalDispatch,
  ) => void;
  setLiveIntervalOperation: (
    state: IntegrationGlobalState,
    action: SetLiveIntervalAction,
    dispatch?: SignalDispatch,
  ) => void;
}
