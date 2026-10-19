/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { OriginalSourceQueueGlobalState } from "../types.js";
import type {
  AddCollectionValueAction,
  ClearCollectionAction,
} from "./actions.js";

export interface OriginalSourceQueueCollectionsOperations {
  addCollectionValueOperation: (
    state: OriginalSourceQueueGlobalState,
    action: AddCollectionValueAction,
    dispatch?: SignalDispatch,
  ) => void;
  clearCollectionOperation: (
    state: OriginalSourceQueueGlobalState,
    action: ClearCollectionAction,
    dispatch?: SignalDispatch,
  ) => void;
}
