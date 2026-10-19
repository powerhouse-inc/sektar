/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { OriginalSourceQueueGlobalState } from "../types.js";
import type { ReportErrorAction } from "./actions.js";

export interface OriginalSourceQueueErrorsOperations {
  reportErrorOperation: (
    state: OriginalSourceQueueGlobalState,
    action: ReportErrorAction,
    dispatch?: SignalDispatch,
  ) => void;
}
