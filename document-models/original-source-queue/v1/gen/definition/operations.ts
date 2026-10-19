/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { OriginalSourceQueueGlobalState } from "../types.js";
import type {
  CreateCollectionAction,
  CreateCollectionCursorAction,
  CreateDateTimeCursorAction,
  CreateNumberCursorAction,
  ReorderCursorsAction,
  SetCursorNameAction,
} from "./actions.js";

export interface OriginalSourceQueueDefinitionOperations {
  createDateTimeCursorOperation: (
    state: OriginalSourceQueueGlobalState,
    action: CreateDateTimeCursorAction,
    dispatch?: SignalDispatch,
  ) => void;
  createNumberCursorOperation: (
    state: OriginalSourceQueueGlobalState,
    action: CreateNumberCursorAction,
    dispatch?: SignalDispatch,
  ) => void;
  createCollectionCursorOperation: (
    state: OriginalSourceQueueGlobalState,
    action: CreateCollectionCursorAction,
    dispatch?: SignalDispatch,
  ) => void;
  reorderCursorsOperation: (
    state: OriginalSourceQueueGlobalState,
    action: ReorderCursorsAction,
    dispatch?: SignalDispatch,
  ) => void;
  setCursorNameOperation: (
    state: OriginalSourceQueueGlobalState,
    action: SetCursorNameAction,
    dispatch?: SignalDispatch,
  ) => void;
  createCollectionOperation: (
    state: OriginalSourceQueueGlobalState,
    action: CreateCollectionAction,
    dispatch?: SignalDispatch,
  ) => void;
}
