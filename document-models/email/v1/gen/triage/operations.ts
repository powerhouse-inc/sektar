/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { EmailGlobalState } from "../types.js";
import type {
  AddLabelsAction,
  ArchiveAction,
  MarkReadAction,
  MarkUnreadAction,
  RemoveLabelsAction,
  SetFlaggedAction,
  UnarchiveAction,
} from "./actions.js";

export interface EmailTriageOperations {
  markReadOperation: (
    state: EmailGlobalState,
    action: MarkReadAction,
    dispatch?: SignalDispatch,
  ) => void;
  markUnreadOperation: (
    state: EmailGlobalState,
    action: MarkUnreadAction,
    dispatch?: SignalDispatch,
  ) => void;
  setFlaggedOperation: (
    state: EmailGlobalState,
    action: SetFlaggedAction,
    dispatch?: SignalDispatch,
  ) => void;
  archiveOperation: (
    state: EmailGlobalState,
    action: ArchiveAction,
    dispatch?: SignalDispatch,
  ) => void;
  unarchiveOperation: (
    state: EmailGlobalState,
    action: UnarchiveAction,
    dispatch?: SignalDispatch,
  ) => void;
  addLabelsOperation: (
    state: EmailGlobalState,
    action: AddLabelsAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeLabelsOperation: (
    state: EmailGlobalState,
    action: RemoveLabelsAction,
    dispatch?: SignalDispatch,
  ) => void;
}
