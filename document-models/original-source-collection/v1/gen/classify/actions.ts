/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  DiscardSourceInput,
  SetSourceStatusInput,
  SetSourceTitleInput,
  TagSourceInput,
  UntagSourceInput,
} from "../types.js";

export type SetSourceTitleAction = Action & {
  type: "SET_SOURCE_TITLE";
  input: SetSourceTitleInput;
};
export type TagSourceAction = Action & {
  type: "TAG_SOURCE";
  input: TagSourceInput;
};
export type UntagSourceAction = Action & {
  type: "UNTAG_SOURCE";
  input: UntagSourceInput;
};
export type SetSourceStatusAction = Action & {
  type: "SET_SOURCE_STATUS";
  input: SetSourceStatusInput;
};
export type DiscardSourceAction = Action & {
  type: "DISCARD_SOURCE";
  input: DiscardSourceInput;
};

export type OriginalSourceCollectionClassifyAction =
  | SetSourceTitleAction
  | TagSourceAction
  | UntagSourceAction
  | SetSourceStatusAction
  | DiscardSourceAction;
