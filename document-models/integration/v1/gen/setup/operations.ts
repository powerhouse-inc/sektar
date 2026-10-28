/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { IntegrationGlobalState } from "../types.js";
import type { InitializeAction, SetCalendarSourceAction } from "./actions.js";

export interface IntegrationSetupOperations {
  initializeOperation: (
    state: IntegrationGlobalState,
    action: InitializeAction,
    dispatch?: SignalDispatch,
  ) => void;
  setCalendarSourceOperation: (
    state: IntegrationGlobalState,
    action: SetCalendarSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
}
