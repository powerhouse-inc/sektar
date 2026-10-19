/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { OriginalSourceQueueGlobalState } from "../types.js";
import type {
  PauseAction,
  ResetAction,
  StartAction,
  TerminateAction,
  UnpauseAction,
} from "./actions.js";

export interface OriginalSourceQueueLifecycleOperations {
  startOperation: (
    state: OriginalSourceQueueGlobalState,
    action: StartAction,
    dispatch?: SignalDispatch,
  ) => void;
  pauseOperation: (
    state: OriginalSourceQueueGlobalState,
    action: PauseAction,
    dispatch?: SignalDispatch,
  ) => void;
  unpauseOperation: (
    state: OriginalSourceQueueGlobalState,
    action: UnpauseAction,
    dispatch?: SignalDispatch,
  ) => void;
  resetOperation: (
    state: OriginalSourceQueueGlobalState,
    action: ResetAction,
    dispatch?: SignalDispatch,
  ) => void;
  terminateOperation: (
    state: OriginalSourceQueueGlobalState,
    action: TerminateAction,
    dispatch?: SignalDispatch,
  ) => void;
}
