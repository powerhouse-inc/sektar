/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { InvoiceGlobalState } from "../types.js";
import type {
  AddAttachmentAction,
  MoveAttachmentAction,
  RemoveAttachmentAction,
  UpdateAttachmentAction,
} from "./actions.js";

export interface InvoiceAttachmentsOperations {
  addAttachmentOperation: (
    state: InvoiceGlobalState,
    action: AddAttachmentAction,
    dispatch?: SignalDispatch,
  ) => void;
  updateAttachmentOperation: (
    state: InvoiceGlobalState,
    action: UpdateAttachmentAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeAttachmentOperation: (
    state: InvoiceGlobalState,
    action: RemoveAttachmentAction,
    dispatch?: SignalDispatch,
  ) => void;
  moveAttachmentOperation: (
    state: InvoiceGlobalState,
    action: MoveAttachmentAction,
    dispatch?: SignalDispatch,
  ) => void;
}
