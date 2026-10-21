/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { FolderSyncGlobalState } from "../types.js";
import type { RequestSyncAction } from "./actions.js";

export interface FolderSyncSyncOperations {
  requestSyncOperation: (
    state: FolderSyncGlobalState,
    action: RequestSyncAction,
    dispatch?: SignalDispatch,
  ) => void;
}
