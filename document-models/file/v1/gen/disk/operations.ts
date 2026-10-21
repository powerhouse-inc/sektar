/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { FileGlobalState } from "../types.js";
import type {
  ApplyDiskVersionAction,
  ClearPlaceholderAction,
  SetPlaceholderAction,
} from "./actions.js";

export interface FileDiskOperations {
  setPlaceholderOperation: (
    state: FileGlobalState,
    action: SetPlaceholderAction,
    dispatch?: SignalDispatch,
  ) => void;
  clearPlaceholderOperation: (
    state: FileGlobalState,
    action: ClearPlaceholderAction,
    dispatch?: SignalDispatch,
  ) => void;
  applyDiskVersionOperation: (
    state: FileGlobalState,
    action: ApplyDiskVersionAction,
    dispatch?: SignalDispatch,
  ) => void;
}
