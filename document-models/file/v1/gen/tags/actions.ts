/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { AddTagInput, RemoveTagInput, UpdateTagInput } from "../types.js";

export type AddTagAction = Action & { type: "ADD_TAG"; input: AddTagInput };
export type UpdateTagAction = Action & {
  type: "UPDATE_TAG";
  input: UpdateTagInput;
};
export type RemoveTagAction = Action & {
  type: "REMOVE_TAG";
  input: RemoveTagInput;
};

export type FileTagsAction = AddTagAction | UpdateTagAction | RemoveTagAction;
