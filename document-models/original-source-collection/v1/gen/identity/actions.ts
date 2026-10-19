/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddAliasInput,
  MergeSourcesInput,
  RemoveAliasInput,
  SplitSourceInput,
} from "../types.js";

export type AddAliasAction = Action & {
  type: "ADD_ALIAS";
  input: AddAliasInput;
};
export type RemoveAliasAction = Action & {
  type: "REMOVE_ALIAS";
  input: RemoveAliasInput;
};
export type MergeSourcesAction = Action & {
  type: "MERGE_SOURCES";
  input: MergeSourcesInput;
};
export type SplitSourceAction = Action & {
  type: "SPLIT_SOURCE";
  input: SplitSourceInput;
};

export type OriginalSourceCollectionIdentityAction =
  | AddAliasAction
  | RemoveAliasAction
  | MergeSourcesAction
  | SplitSourceAction;
