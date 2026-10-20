/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating TripDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  TripDocument,
  TripGlobalState,
  TripLocalState,
  TripPHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): TripGlobalState {
  return {
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
}

export function defaultLocalState(): TripLocalState {
  return {};
}

export function defaultPHState(): TripPHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<TripGlobalState>,
): TripGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<TripLocalState>,
): TripLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as TripLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<TripGlobalState>,
  localState?: Partial<TripLocalState>,
): TripPHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a TripDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createTripDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<TripGlobalState>;
    local?: Partial<TripLocalState>;
  }>,
): TripDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
