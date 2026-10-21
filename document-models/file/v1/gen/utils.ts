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
import { fileUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsFileDocument,
  assertIsFileState,
  isFileDocument,
  isFileState,
} from "./document-schema.js";
import { fileDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type { FileGlobalState, FileLocalState, FilePHState } from "./types.js";

export const initialGlobalState: FileGlobalState = {
  title: null,
  description: null,
  source: null,
  renditions: [],
  tags: [],
  placeholder: null,
};
export const initialLocalState: FileLocalState = {};

export const utils: DocumentModelUtils<FilePHState> = {
  fileExtension: "file",
  createState(state) {
    return {
      ...createBaseState(state?.auth, { version: 1, ...state?.document }),
      global: { ...initialGlobalState, ...state?.global },
      local: { ...initialLocalState, ...state?.local },
    };
  },
  createDocument(state) {
    return baseCreateDocument(utils.createState, state, fileDocumentType);
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: fileUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isFileState(state);
  },
  assertIsStateOfType(state) {
    return assertIsFileState(state);
  },
  isDocumentOfType(document) {
    return isFileDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsFileDocument(document);
  },
};
