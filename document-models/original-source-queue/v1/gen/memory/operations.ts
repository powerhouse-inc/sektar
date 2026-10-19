/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { OriginalSourceQueueGlobalState } from "../types.js";
import type { UpdateMemoryAction } from "./actions.js";

export interface OriginalSourceQueueMemoryOperations {
  updateMemoryOperation: (
    state: OriginalSourceQueueGlobalState,
    action: UpdateMemoryAction,
    dispatch?: SignalDispatch,
  ) => void;
}
