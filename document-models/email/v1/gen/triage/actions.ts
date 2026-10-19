/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddLabelsInput,
  ArchiveInput,
  MarkReadInput,
  MarkUnreadInput,
  RemoveLabelsInput,
  SetFlaggedInput,
  UnarchiveInput,
} from "../types.js";

export type MarkReadAction = Action & {
  type: "MARK_READ";
  input: MarkReadInput;
};
export type MarkUnreadAction = Action & {
  type: "MARK_UNREAD";
  input: MarkUnreadInput;
};
export type SetFlaggedAction = Action & {
  type: "SET_FLAGGED";
  input: SetFlaggedInput;
};
export type ArchiveAction = Action & { type: "ARCHIVE"; input: ArchiveInput };
export type UnarchiveAction = Action & {
  type: "UNARCHIVE";
  input: UnarchiveInput;
};
export type AddLabelsAction = Action & {
  type: "ADD_LABELS";
  input: AddLabelsInput;
};
export type RemoveLabelsAction = Action & {
  type: "REMOVE_LABELS";
  input: RemoveLabelsInput;
};

export type EmailTriageAction =
  | MarkReadAction
  | MarkUnreadAction
  | SetFlaggedAction
  | ArchiveAction
  | UnarchiveAction
  | AddLabelsAction
  | RemoveLabelsAction;
