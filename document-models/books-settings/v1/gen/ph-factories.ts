/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating BooksSettingsDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  BooksSettingsDocument,
  BooksSettingsGlobalState,
  BooksSettingsLocalState,
  BooksSettingsPHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): BooksSettingsGlobalState {
  return { baseCurrency: "EUR", baseCurrencyChangedAt: null };
}

export function defaultLocalState(): BooksSettingsLocalState {
  return {};
}

export function defaultPHState(): BooksSettingsPHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<BooksSettingsGlobalState>,
): BooksSettingsGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<BooksSettingsLocalState>,
): BooksSettingsLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as BooksSettingsLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<BooksSettingsGlobalState>,
  localState?: Partial<BooksSettingsLocalState>,
): BooksSettingsPHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a BooksSettingsDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createBooksSettingsDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<BooksSettingsGlobalState>;
    local?: Partial<BooksSettingsLocalState>;
  }>,
): BooksSettingsDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
