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
import { originalSourceQueueUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsOriginalSourceQueueDocument,
  assertIsOriginalSourceQueueState,
  isOriginalSourceQueueDocument,
  isOriginalSourceQueueState,
} from "./document-schema.js";
import { originalSourceQueueDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type {
  OriginalSourceQueueGlobalState,
  OriginalSourceQueueLocalState,
  OriginalSourceQueuePHState,
} from "./types.js";

export const initialGlobalState: OriginalSourceQueueGlobalState = {
  description: null,
  cursors: [],
  collections: [],
  memory: [],
  errors: [],
  progress: 0,
  status: "DRAFT",
  awaitingValues: false,
};
export const initialLocalState: OriginalSourceQueueLocalState = {};

export const utils: DocumentModelUtils<OriginalSourceQueuePHState> = {
  fileExtension: "osq",
  createState(state) {
    return {
      ...createBaseState(state?.auth, { version: 1, ...state?.document }),
      global: { ...initialGlobalState, ...state?.global },
      local: { ...initialLocalState, ...state?.local },
    };
  },
  createDocument(state) {
    return baseCreateDocument(
      utils.createState,
      state,
      originalSourceQueueDocumentType,
    );
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: originalSourceQueueUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isOriginalSourceQueueState(state);
  },
  assertIsStateOfType(state) {
    return assertIsOriginalSourceQueueState(state);
  },
  isDocumentOfType(document) {
    return isOriginalSourceQueueDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsOriginalSourceQueueDocument(document);
  },
};
