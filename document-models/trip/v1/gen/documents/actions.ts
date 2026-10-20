/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddAttachmentInput,
  AddSourceInput,
  RemoveAttachmentInput,
  RemoveSourceInput,
} from "../types.js";

export type AddAttachmentAction = Action & {
  type: "ADD_ATTACHMENT";
  input: AddAttachmentInput;
};
export type RemoveAttachmentAction = Action & {
  type: "REMOVE_ATTACHMENT";
  input: RemoveAttachmentInput;
};
export type AddSourceAction = Action & {
  type: "ADD_SOURCE";
  input: AddSourceInput;
};
export type RemoveSourceAction = Action & {
  type: "REMOVE_SOURCE";
  input: RemoveSourceInput;
};

export type TripDocumentsAction =
  | AddAttachmentAction
  | RemoveAttachmentAction
  | AddSourceAction
  | RemoveSourceAction;
