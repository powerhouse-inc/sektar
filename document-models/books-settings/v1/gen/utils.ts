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
import { booksSettingsUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsBooksSettingsDocument,
  assertIsBooksSettingsState,
  isBooksSettingsDocument,
  isBooksSettingsState,
} from "./document-schema.js";
import { booksSettingsDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type {
  BooksSettingsGlobalState,
  BooksSettingsLocalState,
  BooksSettingsPHState,
} from "./types.js";

export const initialGlobalState: BooksSettingsGlobalState = {
  baseCurrency: "EUR",
  baseCurrencyChangedAt: null,
};
export const initialLocalState: BooksSettingsLocalState = {};

export const utils: DocumentModelUtils<BooksSettingsPHState> = {
  fileExtension: "bks",
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
      booksSettingsDocumentType,
    );
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: booksSettingsUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isBooksSettingsState(state);
  },
  assertIsStateOfType(state) {
    return assertIsBooksSettingsState(state);
  },
  isDocumentOfType(document) {
    return isBooksSettingsDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsBooksSettingsDocument(document);
  },
};
