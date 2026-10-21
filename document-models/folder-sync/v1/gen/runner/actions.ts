/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  FinishRunInput,
  ResolveIssueInput,
  SetIssuesInput,
  StartRunInput,
} from "../types.js";

export type StartRunAction = Action & {
  type: "START_RUN";
  input: StartRunInput;
};
export type FinishRunAction = Action & {
  type: "FINISH_RUN";
  input: FinishRunInput;
};
export type SetIssuesAction = Action & {
  type: "SET_ISSUES";
  input: SetIssuesInput;
};
export type ResolveIssueAction = Action & {
  type: "RESOLVE_ISSUE";
  input: ResolveIssueInput;
};

export type FolderSyncRunnerAction =
  | StartRunAction
  | FinishRunAction
  | SetIssuesAction
  | ResolveIssueAction;
