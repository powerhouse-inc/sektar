/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { DocumentModelUtils, PHBaseState, Reducer } from "document-model";
import {
  baseCreateDocument,
  baseLoadFromInputVersioned,
  baseSaveToFileHandle,
  createBaseState,
} from "document-model";
import { calendarEventUpgradeManifest } from "../../upgrades/upgrade-manifest.js";
import {
  assertIsCalendarEventDocument,
  assertIsCalendarEventState,
  isCalendarEventDocument,
  isCalendarEventState,
} from "./document-schema.js";
import { calendarEventDocumentType } from "./document-type.js";
import { reducer } from "./reducer.js";
import type {
  CalendarEventGlobalState,
  CalendarEventLocalState,
  CalendarEventPHState,
} from "./types.js";

export const initialGlobalState: CalendarEventGlobalState = {
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
export const initialLocalState: CalendarEventLocalState = {};

export const utils: DocumentModelUtils<CalendarEventPHState> = {
  fileExtension: "evt",
  createState(state) {
    return {
      ...createBaseState(state?.auth, { version: 1, ...state?.document }),
      global: { ...initialGlobalState, ...state?.global },
      local: { ...initialLocalState, ...state?.local },
    };
  },
  createDocument(state) {
    return baseCreateDocument(
      utils.createState,
      state,
      calendarEventDocumentType,
    );
  },
  saveToFileHandle(document, input) {
    return baseSaveToFileHandle(document, input);
  },
  loadFromInput(input) {
    return baseLoadFromInputVersioned(input, {
      reducers: { 1: reducer as unknown as Reducer<PHBaseState> },
      upgradeManifest: calendarEventUpgradeManifest,
    });
  },
  isStateOfType(state) {
    return isCalendarEventState(state);
  },
  assertIsStateOfType(state) {
    return assertIsCalendarEventState(state);
  },
  isDocumentOfType(document) {
    return isCalendarEventDocument(document);
  },
  assertIsDocumentOfType(document) {
    return assertIsCalendarEventDocument(document);
  },
};
