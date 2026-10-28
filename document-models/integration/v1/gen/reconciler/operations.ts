/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { IntegrationGlobalState } from "../types.js";
import type {
  RecordBackfillDocumentAction,
  RecordCheckAction,
  RecordResourcesAction,
  RecordRunnerAction,
  RequestCheckAction,
} from "./actions.js";

export interface IntegrationReconcilerOperations {
  requestCheckOperation: (
    state: IntegrationGlobalState,
    action: RequestCheckAction,
    dispatch?: SignalDispatch,
  ) => void;
  recordRunnerOperation: (
    state: IntegrationGlobalState,
    action: RecordRunnerAction,
    dispatch?: SignalDispatch,
  ) => void;
  recordResourcesOperation: (
    state: IntegrationGlobalState,
    action: RecordResourcesAction,
    dispatch?: SignalDispatch,
  ) => void;
  recordBackfillDocumentOperation: (
    state: IntegrationGlobalState,
    action: RecordBackfillDocumentAction,
    dispatch?: SignalDispatch,
  ) => void;
  recordCheckOperation: (
    state: IntegrationGlobalState,
    action: RecordCheckAction,
    dispatch?: SignalDispatch,
  ) => void;
}
