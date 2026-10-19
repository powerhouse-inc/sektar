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
import { emailUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsEmailDocument,
  assertIsEmailState,
  isEmailDocument,
  isEmailState,
} from "./document-schema.js";
import { emailDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type {
  EmailGlobalState,
  EmailLocalState,
  EmailPHState,
} from "./types.js";

export const initialGlobalState: EmailGlobalState = {
  account: { address: null, name: null, provider: null },
  externalId: null,
  messageId: null,
  threadId: null,
  inReplyTo: null,
  references: [],
  subject: null,
  from: [],
  to: [],
  cc: [],
  bcc: [],
  replyTo: [],
  sentAt: null,
  receivedAt: null,
  text: null,
  html: null,
  snippet: null,
  headers: [],
  labels: [],
  attachments: [],
  status: "INBOX",
  read: false,
  flagged: false,
  notes: null,
  source: null,
  capturedAt: null,
};
export const initialLocalState: EmailLocalState = {};

export const utils: DocumentModelUtils<EmailPHState> = {
  fileExtension: "mail",
  createState(state) {
    return {
      ...createBaseState(state?.auth, { version: 1, ...state?.document }),
      global: { ...initialGlobalState, ...state?.global },
      local: { ...initialLocalState, ...state?.local },
    };
  },
  createDocument(state) {
    return baseCreateDocument(utils.createState, state, emailDocumentType);
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: emailUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isEmailState(state);
  },
  assertIsStateOfType(state) {
    return assertIsEmailState(state);
  },
  isDocumentOfType(document) {
    return isEmailDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsEmailDocument(document);
  },
};
