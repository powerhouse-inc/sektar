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
import { invoiceUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsInvoiceDocument,
  assertIsInvoiceState,
  isInvoiceDocument,
  isInvoiceState,
} from "./document-schema.js";
import { invoiceDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type {
  InvoiceGlobalState,
  InvoiceLocalState,
  InvoicePHState,
} from "./types.js";

export const initialGlobalState: InvoiceGlobalState = {
  direction: "OUTGOING",
  number: null,
  status: "DRAFT",
  counterparty: {
    name: null,
    contactId: null,
    email: null,
    vatId: null,
    address: null,
  },
  issuedAt: null,
  dueAt: null,
  currency: "EUR",
  lines: [],
  payments: [],
  reference: null,
  notes: null,
  voidReason: null,
};
export const initialLocalState: InvoiceLocalState = {};

export const utils: DocumentModelUtils<InvoicePHState> = {
  fileExtension: "inv",
  createState(state) {
    return {
      ...createBaseState(state?.auth, { version: 1, ...state?.document }),
      global: { ...initialGlobalState, ...state?.global },
      local: { ...initialLocalState, ...state?.local },
    };
  },
  createDocument(state) {
    return baseCreateDocument(utils.createState, state, invoiceDocumentType);
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: invoiceUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isInvoiceState(state);
  },
  assertIsStateOfType(state) {
    return assertIsInvoiceState(state);
  },
  isDocumentOfType(document) {
    return isInvoiceDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsInvoiceDocument(document);
  },
};
