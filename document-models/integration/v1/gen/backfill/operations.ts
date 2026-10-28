/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { IntegrationGlobalState } from "../types.js";
import type {
  AddDateRangeBackfillAction,
  RemoveBackfillAction,
  SetBackfillEnabledAction,
} from "./actions.js";

export interface IntegrationBackfillOperations {
  setBackfillEnabledOperation: (
    state: IntegrationGlobalState,
    action: SetBackfillEnabledAction,
    dispatch?: SignalDispatch,
  ) => void;
  addDateRangeBackfillOperation: (
    state: IntegrationGlobalState,
    action: AddDateRangeBackfillAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeBackfillOperation: (
    state: IntegrationGlobalState,
    action: RemoveBackfillAction,
    dispatch?: SignalDispatch,
  ) => void;
}
