/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating CurrencyPairDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  CurrencyPairDocument,
  CurrencyPairGlobalState,
  CurrencyPairLocalState,
  CurrencyPairPHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): CurrencyPairGlobalState {
  return { base: null, quote: null, rates: [], lastFetchedAt: null };
}

export function defaultLocalState(): CurrencyPairLocalState {
  return {};
}

export function defaultPHState(): CurrencyPairPHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<CurrencyPairGlobalState>,
): CurrencyPairGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<CurrencyPairLocalState>,
): CurrencyPairLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as CurrencyPairLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<CurrencyPairGlobalState>,
  localState?: Partial<CurrencyPairLocalState>,
): CurrencyPairPHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a CurrencyPairDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createCurrencyPairDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<CurrencyPairGlobalState>;
    local?: Partial<CurrencyPairLocalState>;
  }>,
): CurrencyPairDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
