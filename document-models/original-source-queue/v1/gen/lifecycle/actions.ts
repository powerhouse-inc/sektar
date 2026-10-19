/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  PauseInput,
  ResetInput,
  StartInput,
  TerminateInput,
  UnpauseInput,
} from "../types.js";

export type StartAction = Action & { type: "START"; input: StartInput };
export type PauseAction = Action & { type: "PAUSE"; input: PauseInput };
export type UnpauseAction = Action & { type: "UNPAUSE"; input: UnpauseInput };
export type ResetAction = Action & { type: "RESET"; input: ResetInput };
export type TerminateAction = Action & {
  type: "TERMINATE";
  input: TerminateInput;
};

export type OriginalSourceQueueLifecycleAction =
  | StartAction
  | PauseAction
  | UnpauseAction
  | ResetAction
  | TerminateAction;
