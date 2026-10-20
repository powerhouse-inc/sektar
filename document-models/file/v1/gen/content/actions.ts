/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  ClearSourceInput,
  SetAttachmentSourceInput,
  SetDescriptionInput,
  SetDocumentSourceInput,
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
export type SetAttachmentSourceAction = Action & {
  type: "SET_ATTACHMENT_SOURCE";
  input: SetAttachmentSourceInput;
};
export type SetDocumentSourceAction = Action & {
  type: "SET_DOCUMENT_SOURCE";
  input: SetDocumentSourceInput;
};
export type ClearSourceAction = Action & {
  type: "CLEAR_SOURCE";
  input: ClearSourceInput;
};

export type FileContentAction =
  | SetTitleAction
  | SetDescriptionAction
  | SetAttachmentSourceAction
  | SetDocumentSourceAction
  | ClearSourceAction;
