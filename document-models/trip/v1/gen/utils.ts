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
import { tripUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsTripDocument,
  assertIsTripState,
  isTripDocument,
  isTripState,
} from "./document-schema.js";
import { tripDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type { TripGlobalState, TripLocalState, TripPHState } from "./types.js";

export const initialGlobalState: TripGlobalState = {
  title: null,
  purpose: null,
  purposeKind: null,
  status: "PLANNED",
  startDate: null,
  endDate: null,
  traveler: null,
  destinations: [],
  billing: null,
  currency: "EUR",
  transport: [],
  stays: [],
  meals: [],
  extras: [],
  attachments: [],
  sources: [],
  notes: null,
};
export const initialLocalState: TripLocalState = {};

export const utils: DocumentModelUtils<TripPHState> = {
  fileExtension: "trip",
  createState(state) {
    return {
      ...createBaseState(state?.auth, { version: 1, ...state?.document }),
      global: { ...initialGlobalState, ...state?.global },
      local: { ...initialLocalState, ...state?.local },
    };
  },
  createDocument(state) {
    return baseCreateDocument(utils.createState, state, tripDocumentType);
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: tripUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isTripState(state);
  },
  assertIsStateOfType(state) {
    return assertIsTripState(state);
  },
  isDocumentOfType(document) {
    return isTripDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsTripDocument(document);
  },
};
