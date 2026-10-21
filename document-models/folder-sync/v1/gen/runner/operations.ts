/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { FolderSyncGlobalState } from "../types.js";
import type {
  FinishRunAction,
  ResolveIssueAction,
  SetIssuesAction,
  StartRunAction,
} from "./actions.js";

export interface FolderSyncRunnerOperations {
  startRunOperation: (
    state: FolderSyncGlobalState,
    action: StartRunAction,
    dispatch?: SignalDispatch,
  ) => void;
  finishRunOperation: (
    state: FolderSyncGlobalState,
    action: FinishRunAction,
    dispatch?: SignalDispatch,
  ) => void;
  setIssuesOperation: (
    state: FolderSyncGlobalState,
    action: SetIssuesAction,
    dispatch?: SignalDispatch,
  ) => void;
  resolveIssueOperation: (
    state: FolderSyncGlobalState,
    action: ResolveIssueAction,
    dispatch?: SignalDispatch,
  ) => void;
}
