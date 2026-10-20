/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddAttachmentInput,
  MoveAttachmentInput,
  RemoveAttachmentInput,
  UpdateAttachmentInput,
} from "../types.js";

export type AddAttachmentAction = Action & {
  type: "ADD_ATTACHMENT";
  input: AddAttachmentInput;
};
export type UpdateAttachmentAction = Action & {
  type: "UPDATE_ATTACHMENT";
  input: UpdateAttachmentInput;
};
export type RemoveAttachmentAction = Action & {
  type: "REMOVE_ATTACHMENT";
  input: RemoveAttachmentInput;
};
export type MoveAttachmentAction = Action & {
  type: "MOVE_ATTACHMENT";
  input: MoveAttachmentInput;
};

export type InvoiceAttachmentsAction =
  | AddAttachmentAction
  | UpdateAttachmentAction
  | RemoveAttachmentAction
  | MoveAttachmentAction;
