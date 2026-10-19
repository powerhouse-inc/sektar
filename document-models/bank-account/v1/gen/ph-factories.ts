/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating BankAccountDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  BankAccountDocument,
  BankAccountGlobalState,
  BankAccountLocalState,
  BankAccountPHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): BankAccountGlobalState {
  return {
    name: null,
    institution: null,
    iban: null,
    kind: "CURRENT",
    currency: "EUR",
    openingBalance: 0,
    transactions: [],
    lastImportedAt: null,
  };
}

export function defaultLocalState(): BankAccountLocalState {
  return {};
}

export function defaultPHState(): BankAccountPHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<BankAccountGlobalState>,
): BankAccountGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<BankAccountLocalState>,
): BankAccountLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as BankAccountLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<BankAccountGlobalState>,
  localState?: Partial<BankAccountLocalState>,
): BankAccountPHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a BankAccountDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createBankAccountDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<BankAccountGlobalState>;
    local?: Partial<BankAccountLocalState>;
  }>,
): BankAccountDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
