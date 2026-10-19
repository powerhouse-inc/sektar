/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { EmailGlobalState } from "../types.js";
import type {
  CaptureMessageAction,
  SetAccountAction,
  SetNotesAction,
} from "./actions.js";

export interface EmailMessageOperations {
  setAccountOperation: (
    state: EmailGlobalState,
    action: SetAccountAction,
    dispatch?: SignalDispatch,
  ) => void;
  captureMessageOperation: (
    state: EmailGlobalState,
    action: CaptureMessageAction,
    dispatch?: SignalDispatch,
  ) => void;
  setNotesOperation: (
    state: EmailGlobalState,
    action: SetNotesAction,
    dispatch?: SignalDispatch,
  ) => void;
}
