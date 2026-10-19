/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { AddAttachmentInput, RemoveAttachmentInput } from "../types.js";

export type AddAttachmentAction = Action & {
  type: "ADD_ATTACHMENT";
  input: AddAttachmentInput;
};
export type RemoveAttachmentAction = Action & {
  type: "REMOVE_ATTACHMENT";
  input: RemoveAttachmentInput;
};

export type EmailAttachmentsAction =
  | AddAttachmentAction
  | RemoveAttachmentAction;
