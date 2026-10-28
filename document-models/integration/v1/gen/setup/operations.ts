/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { IntegrationGlobalState } from "../types.js";
import type {
  InitializeAction,
  SetAccessAction,
  SetCalendarSourceAction,
  SetConnectionAction,
  SetEmailSourceAction,
  SetTransactionsSourceAction,
} from "./actions.js";

export interface IntegrationSetupOperations {
  initializeOperation: (
    state: IntegrationGlobalState,
    action: InitializeAction,
    dispatch?: SignalDispatch,
  ) => void;
  setAccessOperation: (
    state: IntegrationGlobalState,
    action: SetAccessAction,
    dispatch?: SignalDispatch,
  ) => void;
  setConnectionOperation: (
    state: IntegrationGlobalState,
    action: SetConnectionAction,
    dispatch?: SignalDispatch,
  ) => void;
  setCalendarSourceOperation: (
    state: IntegrationGlobalState,
    action: SetCalendarSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
  setEmailSourceOperation: (
    state: IntegrationGlobalState,
    action: SetEmailSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
  setTransactionsSourceOperation: (
    state: IntegrationGlobalState,
    action: SetTransactionsSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
}
