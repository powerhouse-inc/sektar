/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  RecordBackfillDocumentInput,
  RecordCheckInput,
  RecordResourcesInput,
  RecordRunnerInput,
  RequestCheckInput,
} from "../types.js";

export type RequestCheckAction = Action & {
  type: "REQUEST_CHECK";
  input: RequestCheckInput;
};
export type RecordRunnerAction = Action & {
  type: "RECORD_RUNNER";
  input: RecordRunnerInput;
};
export type RecordResourcesAction = Action & {
  type: "RECORD_RESOURCES";
  input: RecordResourcesInput;
};
export type RecordBackfillDocumentAction = Action & {
  type: "RECORD_BACKFILL_DOCUMENT";
  input: RecordBackfillDocumentInput;
};
export type RecordCheckAction = Action & {
  type: "RECORD_CHECK";
  input: RecordCheckInput;
};

export type IntegrationReconcilerAction =
  | RequestCheckAction
  | RecordRunnerAction
  | RecordResourcesAction
  | RecordBackfillDocumentAction
  | RecordCheckAction;
