/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { DocumentModelUtils, PHBaseState, Reducer } from "document-model";
import {
  baseCreateDocument,
  baseLoadFromInputVersioned,
  baseSaveToFileHandle,
  createBaseState,
} from "document-model";
import { folderSyncUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsFolderSyncDocument,
  assertIsFolderSyncState,
  isFolderSyncDocument,
  isFolderSyncState,
} from "./document-schema.js";
import { folderSyncDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type {
  FolderSyncGlobalState,
  FolderSyncLocalState,
  FolderSyncPHState,
} from "./types.js";

export const initialGlobalState: FolderSyncGlobalState = {
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
  },
  status: "NEVER",
  request: null,
  host: null,
  runs: [],
  issues: [],
  pulls: [],
};
export const initialLocalState: FolderSyncLocalState = {};

export const utils: DocumentModelUtils<FolderSyncPHState> = {
  fileExtension: "sync",
  createState(state) {
    return {
      ...createBaseState(state?.auth, { version: 1, ...state?.document }),
      global: { ...initialGlobalState, ...state?.global },
      local: { ...initialLocalState, ...state?.local },
    };
  },
  createDocument(state) {
    return baseCreateDocument(utils.createState, state, folderSyncDocumentType);
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: folderSyncUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isFolderSyncState(state);
  },
  assertIsStateOfType(state) {
    return assertIsFolderSyncState(state);
  },
  isDocumentOfType(document) {
    return isFolderSyncDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsFolderSyncDocument(document);
  },
};
