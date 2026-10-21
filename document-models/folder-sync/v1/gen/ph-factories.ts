/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating FolderSyncDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  FolderSyncDocument,
  FolderSyncGlobalState,
  FolderSyncLocalState,
  FolderSyncPHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): FolderSyncGlobalState {
  return {
    driveId: null,
    folderId: null,
    folderPath: null,
    localPath: null,
    direction: "TO_DISK",
    enabled: true,
    options: {
      trigger: "MANUAL",
      includeSubfolders: true,
      content: "SOURCE",
      otherDocuments: "SKIP",
      onRemoved: "KEEP",
      onConflict: "SKIP",
      fromDisk: "OFF",
      writeFiles: true,
    },
    status: "NEVER",
    request: null,
    host: null,
    runs: [],
    issues: [],
    pulls: [],
  };
}

export function defaultLocalState(): FolderSyncLocalState {
  return {};
}

export function defaultPHState(): FolderSyncPHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<FolderSyncGlobalState>,
): FolderSyncGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<FolderSyncLocalState>,
): FolderSyncLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as FolderSyncLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<FolderSyncGlobalState>,
  localState?: Partial<FolderSyncLocalState>,
): FolderSyncPHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a FolderSyncDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createFolderSyncDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<FolderSyncGlobalState>;
    local?: Partial<FolderSyncLocalState>;
  }>,
): FolderSyncDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
