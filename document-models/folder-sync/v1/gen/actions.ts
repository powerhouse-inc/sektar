/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { FolderSyncMappingAction } from "./mapping/actions.js";
import type { FolderSyncRunnerAction } from "./runner/actions.js";
import type { FolderSyncSyncAction } from "./sync/actions.js";

export * from "./mapping/actions.js";
export * from "./runner/actions.js";
export * from "./sync/actions.js";

export type FolderSyncAction =
  | FolderSyncMappingAction
  | FolderSyncSyncAction
  | FolderSyncRunnerAction;
