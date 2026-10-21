/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { FolderSyncAction } from "./actions.js";
import type { FolderSyncState as FolderSyncGlobalState } from "./schema/types.js";

type FolderSyncLocalState = Record<PropertyKey, never>;

type FolderSyncPHState = PHBaseState & {
  global: FolderSyncGlobalState;
  local: FolderSyncLocalState;
};
type FolderSyncDocument = PHDocument<FolderSyncPHState>;

export * from "./schema/types.js";

export type {
  FolderSyncAction,
  FolderSyncDocument,
  FolderSyncGlobalState,
  FolderSyncLocalState,
  FolderSyncPHState,
};
