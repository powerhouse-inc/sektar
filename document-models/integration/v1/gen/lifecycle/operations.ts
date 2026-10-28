/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { IntegrationGlobalState } from "../types.js";
import type { ArchiveAction } from "./actions.js";

export interface IntegrationLifecycleOperations {
  archiveOperation: (
    state: IntegrationGlobalState,
    action: ArchiveAction,
    dispatch?: SignalDispatch,
  ) => void;
}
