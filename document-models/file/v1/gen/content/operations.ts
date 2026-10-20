/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { FileGlobalState } from "../types.js";
import type {
  ClearSourceAction,
  SetAttachmentSourceAction,
  SetDescriptionAction,
  SetDocumentSourceAction,
  SetTitleAction,
} from "./actions.js";

export interface FileContentOperations {
  setTitleOperation: (
    state: FileGlobalState,
    action: SetTitleAction,
    dispatch?: SignalDispatch,
  ) => void;
  setDescriptionOperation: (
    state: FileGlobalState,
    action: SetDescriptionAction,
    dispatch?: SignalDispatch,
  ) => void;
  setAttachmentSourceOperation: (
    state: FileGlobalState,
    action: SetAttachmentSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
  setDocumentSourceOperation: (
    state: FileGlobalState,
    action: SetDocumentSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
  clearSourceOperation: (
    state: FileGlobalState,
    action: ClearSourceAction,
    dispatch?: SignalDispatch,
  ) => void;
}
