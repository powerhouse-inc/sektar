/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { CalendarEventAction } from "./actions.js";
import type { CalendarEventState as CalendarEventGlobalState } from "./schema/types.js";

type CalendarEventLocalState = Record<PropertyKey, never>;

type CalendarEventPHState = PHBaseState & {
  global: CalendarEventGlobalState;
  local: CalendarEventLocalState;
};
type CalendarEventDocument = PHDocument<CalendarEventPHState>;

export * from "./schema/types.js";

export type {
  CalendarEventAction,
  CalendarEventDocument,
  CalendarEventGlobalState,
  CalendarEventLocalState,
  CalendarEventPHState,
};
