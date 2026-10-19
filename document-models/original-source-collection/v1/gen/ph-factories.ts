/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating OriginalSourceCollectionDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  OriginalSourceCollectionDocument,
  OriginalSourceCollectionGlobalState,
  OriginalSourceCollectionLocalState,
  OriginalSourceCollectionPHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): OriginalSourceCollectionGlobalState {
  return {
    title: null,
    description: null,
    provenance: null,
    sources: [],
    tasks: [],
    status: "NEW",
    counts: {
      total: 0,
      new: 0,
      processing: 0,
      completed: 0,
      discarded: 0,
      merged: 0,
      openTasks: 0,
    },
  };
}

export function defaultLocalState(): OriginalSourceCollectionLocalState {
  return {};
}

export function defaultPHState(): OriginalSourceCollectionPHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<OriginalSourceCollectionGlobalState>,
): OriginalSourceCollectionGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<OriginalSourceCollectionLocalState>,
): OriginalSourceCollectionLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as OriginalSourceCollectionLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<OriginalSourceCollectionGlobalState>,
  localState?: Partial<OriginalSourceCollectionLocalState>,
): OriginalSourceCollectionPHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a OriginalSourceCollectionDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createOriginalSourceCollectionDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<OriginalSourceCollectionGlobalState>;
    local?: Partial<OriginalSourceCollectionLocalState>;
  }>,
): OriginalSourceCollectionDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
