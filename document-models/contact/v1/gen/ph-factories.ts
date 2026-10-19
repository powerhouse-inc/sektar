/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating ContactDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  ContactDocument,
  ContactGlobalState,
  ContactLocalState,
  ContactPHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): ContactGlobalState {
  return {
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
}

export function defaultLocalState(): ContactLocalState {
  return {};
}

export function defaultPHState(): ContactPHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<ContactGlobalState>,
): ContactGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<ContactLocalState>,
): ContactLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as ContactLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<ContactGlobalState>,
  localState?: Partial<ContactLocalState>,
): ContactPHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a ContactDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createContactDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<ContactGlobalState>;
    local?: Partial<ContactLocalState>;
  }>,
): ContactDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
