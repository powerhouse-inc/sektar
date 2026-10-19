/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { OriginalSourceQueueGlobalState } from "../types.js";
import type { ProceedAction, ProceedWithErrorAction } from "./actions.js";

export interface OriginalSourceQueueAdvanceOperations {
  proceedOperation: (
    state: OriginalSourceQueueGlobalState,
    action: ProceedAction,
    dispatch?: SignalDispatch,
  ) => void;
  proceedWithErrorOperation: (
    state: OriginalSourceQueueGlobalState,
    action: ProceedWithErrorAction,
    dispatch?: SignalDispatch,
  ) => void;
}
