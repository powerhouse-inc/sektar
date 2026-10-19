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
import { contactUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsContactDocument,
  assertIsContactState,
  isContactDocument,
  isContactState,
} from "./document-schema.js";
import { contactDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type {
  ContactGlobalState,
  ContactLocalState,
  ContactPHState,
} from "./types.js";

export const initialGlobalState: ContactGlobalState = {
  name: null,
  kind: "SUPPLIER",
  status: "ACTIVE",
  email: null,
  phone: null,
  website: null,
  vatId: null,
  registrationNumber: null,
  address: { street: null, postalCode: null, city: null, country: null },
  bank: { iban: null, bic: null, accountHolder: null },
  paymentTermsDays: 30,
  defaultCategory: "UNCATEGORIZED",
  tags: [],
  people: [],
  notes: null,
};
export const initialLocalState: ContactLocalState = {};

export const utils: DocumentModelUtils<ContactPHState> = {
  fileExtension: "cnt",
  createState(state) {
    return {
      ...createBaseState(state?.auth, { version: 1, ...state?.document }),
      global: { ...initialGlobalState, ...state?.global },
      local: { ...initialLocalState, ...state?.local },
    };
  },
  createDocument(state) {
    return baseCreateDocument(utils.createState, state, contactDocumentType);
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: contactUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isContactState(state);
  },
  assertIsStateOfType(state) {
    return assertIsContactState(state);
  },
  isDocumentOfType(document) {
    return isContactDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsContactDocument(document);
  },
};
