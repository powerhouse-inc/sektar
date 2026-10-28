/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  CalendarEventAttendee,
  CalendarEventAttendeeInput,
  CalendarEventCalendar,
  CalendarEventCalendarInput,
  CalendarEventPerson,
  CalendarEventPersonInput,
  CalendarEventResponse,
  CalendarEventState,
  CalendarEventStatus,
  CalendarEventTime,
  CalendarEventTimeInput,
  CaptureEventInput,
} from "./types.js";

type Properties<T> = Required<{
  [K in keyof T]: z.ZodType<T[K]>;
}>;

type definedNonNullAny = {};

export const isDefinedNonNullAny = (v: any): v is definedNonNullAny =>
  v !== undefined && v !== null;

export const definedNonNullAnySchema = z
  .any()
  .refine((v) => isDefinedNonNullAny(v));

export const CalendarEventResponseSchema = z.enum([
  "ACCEPTED",
  "DECLINED",
  "NEEDS_ACTION",
  "TENTATIVE",
]);

export const CalendarEventStatusSchema = z.enum([
  "CANCELLED",
  "CONFIRMED",
  "TENTATIVE",
]);

export function CalendarEventAttendeeSchema(): z.ZodObject<
  Properties<CalendarEventAttendee>
> {
  return z.object({
    __typename: z.literal("CalendarEventAttendee").optional(),
    email: z.string(),
    id: z.string(),
    name: z.string().nullish(),
    optional: z.boolean(),
    organizer: z.boolean(),
    response: CalendarEventResponseSchema,
    self: z.boolean(),
  });
}

export function CalendarEventAttendeeInputSchema(): z.ZodObject<
  Properties<CalendarEventAttendeeInput>
> {
  return z.object({
    email: z.string(),
    name: z.string().nullish(),
    optional: z.boolean().nullish(),
    organizer: z.boolean().nullish(),
    response: CalendarEventResponseSchema,
    self: z.boolean().nullish(),
  });
}

export function CalendarEventCalendarSchema(): z.ZodObject<
  Properties<CalendarEventCalendar>
> {
  return z.object({
    __typename: z.literal("CalendarEventCalendar").optional(),
    account: z.string().nullish(),
    id: z.string(),
    name: z.string().nullish(),
  });
}

export function CalendarEventCalendarInputSchema(): z.ZodObject<
  Properties<CalendarEventCalendarInput>
> {
  return z.object({
    account: z.string().nullish(),
    id: z.string(),
    name: z.string().nullish(),
  });
}

export function CalendarEventPersonSchema(): z.ZodObject<
  Properties<CalendarEventPerson>
> {
  return z.object({
    __typename: z.literal("CalendarEventPerson").optional(),
    email: z.string().nullish(),
    name: z.string().nullish(),
  });
}

export function CalendarEventPersonInputSchema(): z.ZodObject<
  Properties<CalendarEventPersonInput>
> {
  return z.object({
    email: z.string().nullish(),
    name: z.string().nullish(),
  });
}

export function CalendarEventStateSchema(): z.ZodObject<
  Properties<CalendarEventState>
> {
  return z.object({
    __typename: z.literal("CalendarEventState").optional(),
    allDay: z.boolean(),
    attendees: z.array(z.lazy(() => CalendarEventAttendeeSchema())),
    busy: z.boolean(),
    calendar: z.lazy(() => CalendarEventCalendarSchema().nullish()),
    capturedAt: z.iso.datetime().nullish(),
    description: z.string().nullish(),
    end: z.lazy(() => CalendarEventTimeSchema().nullish()),
    externalId: z.string().nullish(),
    location: z.string().nullish(),
    meetingUrl: z.string().nullish(),
    organizer: z.lazy(() => CalendarEventPersonSchema().nullish()),
    recurrence: z.array(z.string()),
    recurrenceId: z.string().nullish(),
    source: z.string().nullish(),
    sourceId: z.string().nullish(),
    sourceUpdatedAt: z.iso.datetime().nullish(),
    sourceUrl: z.string().nullish(),
    start: z.lazy(() => CalendarEventTimeSchema().nullish()),
    status: CalendarEventStatusSchema,
    summary: z.string().nullish(),
    uid: z.string().nullish(),
  });
}

export function CalendarEventTimeSchema(): z.ZodObject<
  Properties<CalendarEventTime>
> {
  return z.object({
    __typename: z.literal("CalendarEventTime").optional(),
    at: z.iso.datetime().nullish(),
    date: z.string().nullish(),
    timeZone: z.string().nullish(),
  });
}

export function CalendarEventTimeInputSchema(): z.ZodObject<
  Properties<CalendarEventTimeInput>
> {
  return z.object({
    at: z.iso.datetime().nullish(),
    date: z.string().nullish(),
    timeZone: z.string().nullish(),
  });
}

export function CaptureEventInputSchema(): z.ZodObject<
  Properties<CaptureEventInput>
> {
  return z.object({
    allDay: z.boolean(),
    attendees: z
      .array(z.lazy(() => CalendarEventAttendeeInputSchema()))
      .nullish(),
    busy: z.boolean().nullish(),
    calendar: z.lazy(() => CalendarEventCalendarInputSchema().nullish()),
    capturedAt: z.iso.datetime(),
    description: z.string().nullish(),
    end: z.lazy(() => CalendarEventTimeInputSchema().nullish()),
    externalId: z.string(),
    location: z.string().nullish(),
    meetingUrl: z.string().nullish(),
    organizer: z.lazy(() => CalendarEventPersonInputSchema().nullish()),
    recurrence: z.array(z.string()).nullish(),
    recurrenceId: z.string().nullish(),
    source: z.string(),
    sourceId: z.string().nullish(),
    sourceUpdatedAt: z.iso.datetime().nullish(),
    sourceUrl: z.string().nullish(),
    start: z.lazy(() => CalendarEventTimeInputSchema().nullish()),
    status: CalendarEventStatusSchema,
    summary: z.string().nullish(),
    uid: z.string().nullish(),
  });
}
