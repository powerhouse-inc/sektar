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
import { currencyPairUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsCurrencyPairDocument,
  assertIsCurrencyPairState,
  isCurrencyPairDocument,
  isCurrencyPairState,
} from "./document-schema.js";
import { currencyPairDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type {
  CurrencyPairGlobalState,
  CurrencyPairLocalState,
  CurrencyPairPHState,
} from "./types.js";

export const initialGlobalState: CurrencyPairGlobalState = {
  base: null,
  quote: null,
  rates: [],
  lastFetchedAt: null,
};
export const initialLocalState: CurrencyPairLocalState = {};

export const utils: DocumentModelUtils<CurrencyPairPHState> = {
  fileExtension: "fx",
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
      currencyPairDocumentType,
    );
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: currencyPairUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isCurrencyPairState(state);
  },
  assertIsStateOfType(state) {
    return assertIsCurrencyPairState(state);
  },
  isDocumentOfType(document) {
    return isCurrencyPairDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsCurrencyPairDocument(document);
  },
};
