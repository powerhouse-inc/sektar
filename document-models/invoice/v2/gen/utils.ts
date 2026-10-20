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
import { reducer as reducerV1 } from "../../v1/gen/reducer.js";
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
  kind: "INVOICE",
  direction: "OUTGOING",
  status: "DRAFT",
  number: null,
  subject: null,
  issuedAt: null,
  dueAt: null,
  deliveredAt: null,
  period: null,
  currency: "EUR",
  vatCurrency: null,
  exchangeRates: [],
  seller: {
    name: null,
    contactId: null,
    vatId: null,
    registrationId: null,
    registrationScheme: null,
    endpointId: null,
    endpointScheme: null,
    email: null,
    phone: null,
    street: null,
    additionalStreet: null,
    postalCode: null,
    city: null,
    region: null,
    country: null,
  },
  buyer: {
    name: null,
    contactId: null,
    vatId: null,
    registrationId: null,
    registrationScheme: null,
    endpointId: null,
    endpointScheme: null,
    email: null,
    phone: null,
    street: null,
    additionalStreet: null,
    postalCode: null,
    city: null,
    region: null,
    country: null,
  },
  references: {
    buyerReference: null,
    orderReference: null,
    contractReference: null,
    projectReference: null,
  },
  precedingInvoices: [],
  lines: [],
  vatReasons: [],
  paymentInstructions: {
    meansCode: null,
    meansText: null,
    account: null,
    accountName: null,
    bic: null,
    remittance: null,
  },
  paymentTerms: null,
  roundingAmount: null,
  notes: null,
  attachments: [],
  payments: [],
  voidReason: null,
};
export const initialLocalState: InvoiceLocalState = {};

export const utils: DocumentModelUtils<InvoicePHState> = {
  fileExtension: "inv",
  createState(state) {
    return {
      ...createBaseState(state?.auth, { version: 2, ...state?.document }),
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
      reducers: {
        1: reducerV1 as unknown as Reducer<PHBaseState>,
        2: reducer as unknown as Reducer<PHBaseState>,
      },
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
