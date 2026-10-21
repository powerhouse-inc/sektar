/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { FolderSyncGlobalState } from "../types.js";
import type {
  SetEnabledAction,
  SetLocalPathAction,
  SetOptionsAction,
  SetTargetAction,
} from "./actions.js";

export interface FolderSyncMappingOperations {
  setTargetOperation: (
    state: FolderSyncGlobalState,
    action: SetTargetAction,
    dispatch?: SignalDispatch,
  ) => void;
  setLocalPathOperation: (
    state: FolderSyncGlobalState,
    action: SetLocalPathAction,
    dispatch?: SignalDispatch,
  ) => void;
  setOptionsOperation: (
    state: FolderSyncGlobalState,
    action: SetOptionsAction,
    dispatch?: SignalDispatch,
  ) => void;
  setEnabledOperation: (
    state: FolderSyncGlobalState,
    action: SetEnabledAction,
    dispatch?: SignalDispatch,
  ) => void;
}
