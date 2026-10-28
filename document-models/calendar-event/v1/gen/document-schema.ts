/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import {
  BaseDocumentHeaderSchema,
  BaseDocumentStateSchema,
} from "document-model";
import { z } from "zod";
import { calendarEventDocumentType } from "./document-type.js";
import { CalendarEventStateSchema } from "./schema/zod.js";
import type { CalendarEventDocument, CalendarEventPHState } from "./types.js";

/** Schema for validating the header object of a CalendarEvent document */
export const CalendarEventDocumentHeaderSchema =
  BaseDocumentHeaderSchema.extend({
    documentType: z.literal(calendarEventDocumentType),
  });

/** Schema for validating the state object of a CalendarEvent document */
export const CalendarEventPHStateSchema = BaseDocumentStateSchema.extend({
  global: CalendarEventStateSchema(),
});

export const CalendarEventDocumentSchema = z.object({
  header: CalendarEventDocumentHeaderSchema,
  state: CalendarEventPHStateSchema,
  initialState: CalendarEventPHStateSchema,
});

/** Simple helper function to check if a state object is a CalendarEvent document state object */
export function isCalendarEventState(
  state: unknown,
): state is CalendarEventPHState {
  return CalendarEventPHStateSchema.safeParse(state).success;
}

/** Simple helper function to assert that a document state object is a CalendarEvent document state object */
export function assertIsCalendarEventState(
  state: unknown,
): asserts state is CalendarEventPHState {
  CalendarEventPHStateSchema.parse(state);
}

/** Simple helper function to check if a document is a CalendarEvent document */
export function isCalendarEventDocument(
  document: unknown,
): document is CalendarEventDocument {
  return CalendarEventDocumentSchema.safeParse(document).success;
}

/** Simple helper function to assert that a document is a CalendarEvent document */
export function assertIsCalendarEventDocument(
  document: unknown,
): asserts document is CalendarEventDocument {
  CalendarEventDocumentSchema.parse(document);
}
