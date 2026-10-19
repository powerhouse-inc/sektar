/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  DiscardCollectionInput,
  RestoreCollectionInput,
  SetDescriptionInput,
  SetProvenanceInput,
  SetTitleInput,
} from "../types.js";

export type SetTitleAction = Action & {
  type: "SET_TITLE";
  input: SetTitleInput;
};
export type SetDescriptionAction = Action & {
  type: "SET_DESCRIPTION";
  input: SetDescriptionInput;
};
export type SetProvenanceAction = Action & {
  type: "SET_PROVENANCE";
  input: SetProvenanceInput;
};
export type DiscardCollectionAction = Action & {
  type: "DISCARD_COLLECTION";
  input: DiscardCollectionInput;
};
export type RestoreCollectionAction = Action & {
  type: "RESTORE_COLLECTION";
  input: RestoreCollectionInput;
};

export type OriginalSourceCollectionCollectionAction =
  | SetTitleAction
  | SetDescriptionAction
  | SetProvenanceAction
  | DiscardCollectionAction
  | RestoreCollectionAction;
