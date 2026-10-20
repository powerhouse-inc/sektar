/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddRenditionInput,
  RemoveRenditionInput,
  UpdateRenditionInput,
} from "../types.js";

export type AddRenditionAction = Action & {
  type: "ADD_RENDITION";
  input: AddRenditionInput;
};
export type UpdateRenditionAction = Action & {
  type: "UPDATE_RENDITION";
  input: UpdateRenditionInput;
};
export type RemoveRenditionAction = Action & {
  type: "REMOVE_RENDITION";
  input: RemoveRenditionInput;
};

export type FileRenditionsAction =
  | AddRenditionAction
  | UpdateRenditionAction
  | RemoveRenditionAction;
