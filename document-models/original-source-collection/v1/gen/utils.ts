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
import { originalSourceCollectionUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsOriginalSourceCollectionDocument,
  assertIsOriginalSourceCollectionState,
  isOriginalSourceCollectionDocument,
  isOriginalSourceCollectionState,
} from "./document-schema.js";
import { originalSourceCollectionDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type {
  OriginalSourceCollectionGlobalState,
  OriginalSourceCollectionLocalState,
  OriginalSourceCollectionPHState,
} from "./types.js";

export const initialGlobalState: OriginalSourceCollectionGlobalState = {
  title: null,
  description: null,
  provenance: null,
  sources: [],
  tasks: [],
  status: "NEW",
  counts: {
    total: 0,
    new: 0,
    processing: 0,
    completed: 0,
    discarded: 0,
    merged: 0,
    openTasks: 0,
  },
};
export const initialLocalState: OriginalSourceCollectionLocalState = {};

export const utils: DocumentModelUtils<OriginalSourceCollectionPHState> = {
  fileExtension: "osc",
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
      originalSourceCollectionDocumentType,
    );
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: originalSourceCollectionUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isOriginalSourceCollectionState(state);
  },
  assertIsStateOfType(state) {
    return assertIsOriginalSourceCollectionState(state);
  },
  isDocumentOfType(document) {
    return isOriginalSourceCollectionDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsOriginalSourceCollectionDocument(document);
  },
};
