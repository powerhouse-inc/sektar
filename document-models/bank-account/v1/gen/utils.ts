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
import { bankAccountUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsBankAccountDocument,
  assertIsBankAccountState,
  isBankAccountDocument,
  isBankAccountState,
} from "./document-schema.js";
import { bankAccountDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type {
  BankAccountGlobalState,
  BankAccountLocalState,
  BankAccountPHState,
} from "./types.js";

export const initialGlobalState: BankAccountGlobalState = {
  name: null,
  institution: null,
  iban: null,
  kind: "CURRENT",
  currency: "EUR",
  openingBalance: 0,
  transactions: [],
  lastImportedAt: null,
};
export const initialLocalState: BankAccountLocalState = {};

export const utils: DocumentModelUtils<BankAccountPHState> = {
  fileExtension: "bank",
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
      bankAccountDocumentType,
    );
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: bankAccountUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isBankAccountState(state);
  },
  assertIsStateOfType(state) {
    return assertIsBankAccountState(state);
  },
  isDocumentOfType(document) {
    return isBankAccountDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsBankAccountDocument(document);
  },
};
