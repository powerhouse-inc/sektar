/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { OriginalSourceCollectionGlobalState } from "../types.js";
import type {
  AddSourceReferenceAction,
  AttachToSourceAction,
  CaptureSourceAction,
  DetachFromSourceAction,
} from "./actions.js";

export interface OriginalSourceCollectionCaptureOperations {
  captureSourceOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: CaptureSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
  attachToSourceOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: AttachToSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
  detachFromSourceOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: DetachFromSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
  addSourceReferenceOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: AddSourceReferenceAction,
    dispatch?: SignalDispatch,
  ) => void;
}
