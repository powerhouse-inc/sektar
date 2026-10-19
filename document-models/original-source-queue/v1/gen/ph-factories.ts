/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating OriginalSourceQueueDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  OriginalSourceQueueDocument,
  OriginalSourceQueueGlobalState,
  OriginalSourceQueueLocalState,
  OriginalSourceQueuePHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): OriginalSourceQueueGlobalState {
  return {
    description: null,
    cursors: [],
    collections: [],
    memory: [],
    errors: [],
    progress: 0,
    status: "DRAFT",
    awaitingValues: false,
  };
}

export function defaultLocalState(): OriginalSourceQueueLocalState {
  return {};
}

export function defaultPHState(): OriginalSourceQueuePHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<OriginalSourceQueueGlobalState>,
): OriginalSourceQueueGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<OriginalSourceQueueLocalState>,
): OriginalSourceQueueLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as OriginalSourceQueueLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<OriginalSourceQueueGlobalState>,
  localState?: Partial<OriginalSourceQueueLocalState>,
): OriginalSourceQueuePHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a OriginalSourceQueueDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createOriginalSourceQueueDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<OriginalSourceQueueGlobalState>;
    local?: Partial<OriginalSourceQueueLocalState>;
  }>,
): OriginalSourceQueueDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
