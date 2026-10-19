/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { EmailGlobalState } from "../types.js";
import type { AddAttachmentAction, RemoveAttachmentAction } from "./actions.js";

export interface EmailAttachmentsOperations {
  addAttachmentOperation: (
    state: EmailGlobalState,
    action: AddAttachmentAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeAttachmentOperation: (
    state: EmailGlobalState,
    action: RemoveAttachmentAction,
    dispatch?: SignalDispatch,
  ) => void;
}
