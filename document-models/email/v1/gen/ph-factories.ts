/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating EmailDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  EmailDocument,
  EmailGlobalState,
  EmailLocalState,
  EmailPHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): EmailGlobalState {
  return {
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
}

export function defaultLocalState(): EmailLocalState {
  return {};
}

export function defaultPHState(): EmailPHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<EmailGlobalState>,
): EmailGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<EmailLocalState>,
): EmailLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as EmailLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<EmailGlobalState>,
  localState?: Partial<EmailLocalState>,
): EmailPHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a EmailDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createEmailDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<EmailGlobalState>;
    local?: Partial<EmailLocalState>;
  }>,
): EmailDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
