/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { OriginalSourceCollectionGlobalState } from "../types.js";
import type {
  DiscardCollectionAction,
  RestoreCollectionAction,
  SetDescriptionAction,
  SetProvenanceAction,
  SetTitleAction,
} from "./actions.js";

export interface OriginalSourceCollectionCollectionOperations {
  setTitleOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: SetTitleAction,
    dispatch?: SignalDispatch,
  ) => void;
  setDescriptionOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: SetDescriptionAction,
    dispatch?: SignalDispatch,
  ) => void;
  setProvenanceOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: SetProvenanceAction,
    dispatch?: SignalDispatch,
  ) => void;
  discardCollectionOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: DiscardCollectionAction,
    dispatch?: SignalDispatch,
  ) => void;
  restoreCollectionOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: RestoreCollectionAction,
    dispatch?: SignalDispatch,
  ) => void;
}
