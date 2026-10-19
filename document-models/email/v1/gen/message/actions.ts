/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  CaptureMessageInput,
  SetAccountInput,
  SetNotesInput,
} from "../types.js";

export type SetAccountAction = Action & {
  type: "SET_ACCOUNT";
  input: SetAccountInput;
};
export type CaptureMessageAction = Action & {
  type: "CAPTURE_MESSAGE";
  input: CaptureMessageInput;
};
export type SetNotesAction = Action & {
  type: "SET_NOTES";
  input: SetNotesInput;
};

export type EmailMessageAction =
  | SetAccountAction
  | CaptureMessageAction
  | SetNotesAction;
