/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { OriginalSourceQueueGlobalState } from "../types.js";
import type {
  SetCursorDescriptionAction,
  SetDescriptionAction,
} from "./actions.js";

export interface OriginalSourceQueueMetaOperations {
  setDescriptionOperation: (
    state: OriginalSourceQueueGlobalState,
    action: SetDescriptionAction,
    dispatch?: SignalDispatch,
  ) => void;
  setCursorDescriptionOperation: (
    state: OriginalSourceQueueGlobalState,
    action: SetCursorDescriptionAction,
    dispatch?: SignalDispatch,
  ) => void;
}
