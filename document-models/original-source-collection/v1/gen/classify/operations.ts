/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { OriginalSourceCollectionGlobalState } from "../types.js";
import type {
  DiscardSourceAction,
  SetSourceStatusAction,
  SetSourceTitleAction,
  TagSourceAction,
  UntagSourceAction,
} from "./actions.js";

export interface OriginalSourceCollectionClassifyOperations {
  setSourceTitleOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: SetSourceTitleAction,
    dispatch?: SignalDispatch,
  ) => void;
  tagSourceOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: TagSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
  untagSourceOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: UntagSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
  setSourceStatusOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: SetSourceStatusAction,
    dispatch?: SignalDispatch,
  ) => void;
  discardSourceOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: DiscardSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
}
