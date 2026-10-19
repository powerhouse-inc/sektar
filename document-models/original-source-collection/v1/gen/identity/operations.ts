/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { OriginalSourceCollectionGlobalState } from "../types.js";
import type {
  AddAliasAction,
  MergeSourcesAction,
  RemoveAliasAction,
  SplitSourceAction,
} from "./actions.js";

export interface OriginalSourceCollectionIdentityOperations {
  addAliasOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: AddAliasAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeAliasOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: RemoveAliasAction,
    dispatch?: SignalDispatch,
  ) => void;
  mergeSourcesOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: MergeSourcesAction,
    dispatch?: SignalDispatch,
  ) => void;
  splitSourceOperation: (
    state: OriginalSourceCollectionGlobalState,
    action: SplitSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
}
