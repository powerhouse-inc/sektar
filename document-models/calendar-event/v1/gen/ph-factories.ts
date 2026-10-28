/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 * Factory methods for creating CalendarEventDocument instances
 */
import type { PHAuthState, PHBaseState, PHDocumentState } from "document-model";
import { createBaseState, defaultBaseState } from "document-model";
import type {
  CalendarEventDocument,
  CalendarEventGlobalState,
  CalendarEventLocalState,
  CalendarEventPHState,
} from "./types.js";
import { utils } from "./utils.js";

export function defaultGlobalState(): CalendarEventGlobalState {
  return {
    externalId: null,
    uid: null,
    recurrenceId: null,
    calendar: null,
    source: null,
    sourceId: null,
    sourceUrl: null,
    summary: null,
    description: null,
    location: null,
    meetingUrl: null,
    start: null,
    end: null,
    allDay: false,
    status: "CONFIRMED",
    busy: true,
    organizer: null,
    attendees: [],
    recurrence: [],
    sourceUpdatedAt: null,
    capturedAt: null,
  };
}

export function defaultLocalState(): CalendarEventLocalState {
  return {};
}

export function defaultPHState(): CalendarEventPHState {
  return {
    ...defaultBaseState(),
    global: defaultGlobalState(),
    local: defaultLocalState(),
  };
}

export function createGlobalState(
  state?: Partial<CalendarEventGlobalState>,
): CalendarEventGlobalState {
  return {
    ...defaultGlobalState(),
    ...(state || {}),
  };
}

export function createLocalState(
  state?: Partial<CalendarEventLocalState>,
): CalendarEventLocalState {
  return {
    ...defaultLocalState(),
    ...(state || {}),
  } as CalendarEventLocalState;
}

export function createState(
  baseState?: Partial<PHBaseState>,
  globalState?: Partial<CalendarEventGlobalState>,
  localState?: Partial<CalendarEventLocalState>,
): CalendarEventPHState {
  return {
    ...createBaseState(baseState?.auth, baseState?.document),
    global: createGlobalState(globalState),
    local: createLocalState(localState),
  };
}

/**
 * Creates a CalendarEventDocument with custom global and local state
 * This properly handles the PHBaseState requirements while allowing
 * document-specific state to be set.
 */
export function createCalendarEventDocument(
  state?: Partial<{
    auth?: Partial<PHAuthState>;
    document?: Partial<PHDocumentState>;
    global?: Partial<CalendarEventGlobalState>;
    local?: Partial<CalendarEventLocalState>;
  }>,
): CalendarEventDocument {
  const document = utils.createDocument(
    createState(
      createBaseState(state?.auth, { version: 1, ...state?.document }),
      state?.global,
      state?.local,
    ),
  );

  return document;
}
