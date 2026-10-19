/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating InvoiceDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  InvoiceDocument,
  InvoiceGlobalState,
  InvoiceLocalState,
  InvoicePHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): InvoiceGlobalState {
  return {
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
}

export function defaultLocalState(): InvoiceLocalState {
  return {};
}

export function defaultPHState(): InvoicePHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<InvoiceGlobalState>,
): InvoiceGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<InvoiceLocalState>,
): InvoiceLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as InvoiceLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<InvoiceGlobalState>,
  localState?: Partial<InvoiceLocalState>,
): InvoicePHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a InvoiceDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createInvoiceDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<InvoiceGlobalState>;
    local?: Partial<InvoiceLocalState>;
  }>,
): InvoiceDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
