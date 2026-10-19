/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type { ProceedInput, ProceedWithErrorInput } from "../types.js";

export type ProceedAction = Action & { type: "PROCEED"; input: ProceedInput };
export type ProceedWithErrorAction = Action & {
  type: "PROCEED_WITH_ERROR";
  input: ProceedWithErrorInput;
};

export type OriginalSourceQueueAdvanceAction =
  | ProceedAction
  | ProceedWithErrorAction;
