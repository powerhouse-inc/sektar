/**
 * Google Calendar events to calendar event documents: the adapter between the
 * Google Calendar piece's "New or Updated Event" trigger (one event per run)
 * and the Upsert Documents step, as gmail-to-email is for mail. It reaches
 * nothing; testing it shows the exact actions before any document is written.
 *
 * The key is provider-neutral: the account, the iCalendar UID and, for a
 * changed occurrence of a series, the occurrence's original start
 * (cal:<account>:<UID>[:<recurrence-id>]). Microsoft and CalDAV events carry
 * the same UID, so moving an account to another provider does not duplicate
 * its events. The account is the one the calendar belongs to: Google marks it
 * `self` on the event (creator, organizer or attendee); a configured account
 * wins.
 */
import { createAction, Property } from "@powerhousedao/pieces-framework";

export const CALENDAR_EVENT_TYPE = "sektar/calendar-event";

type Json = Record<string, unknown>;

const record = (v: unknown): Json | null =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;
const text = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;
const list = (v: unknown): unknown[] =>
  Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];

export interface CalendarEventAction {
  type: string;
  input: unknown;
}

/** One event as the upsert step wants it: a key, a name, the actions. */
export interface CalendarEventItem {
  key: string;
  name: string;
  /** The folder it is filed in: the calendar's name, else its account */
  folder: string;
  status: string;
  start: string | null;
  actions: CalendarEventAction[];
  updateActions: CalendarEventAction[];
}

export interface GoogleEventMapOptions {
  /** The calendar the trigger watches */
  calendarId: string;
  calendarName?: string | null;
  /** The account the calendar belongs to; else read off the event's `self` */
  account?: string | null;
  capturedAt: string;
}

export interface GoogleEventMapResult {
  items: CalendarEventItem[];
  skipped: { index: number; reason: string }[];
  count: number;
}

function stripControl(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, " ");
}

/** The event's title for the drive: one line, at most 120 characters. */
export function eventName(summary: string | null): string {
  const one = summary ? stripControl(summary).replace(/\s+/g, " ").trim() : "";
  return one ? one.slice(0, 120) : "(no title)";
}

/** Google's start/end: a dateTime with offset, or a whole-day date. */
function timeOf(
  v: unknown,
): { at?: string; date?: string; timeZone?: string } | null {
  const t = record(v);
  if (!t) return null;
  const tz = text(t.timeZone) ?? undefined;
  const dateTime = text(t.dateTime);
  if (dateTime) {
    const ms = Date.parse(dateTime);
    if (Number.isNaN(ms)) return null;
    return { at: new Date(ms).toISOString(), ...(tz ? { timeZone: tz } : {}) };
  }
  const date = text(t.date);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { date, ...(tz ? { timeZone: tz } : {}) };
  }
  return null;
}

const STATUS: Record<string, string> = {
  confirmed: "CONFIRMED",
  tentative: "TENTATIVE",
  cancelled: "CANCELLED",
  canceled: "CANCELLED",
};

const RESPONSE: Record<string, string> = {
  needsAction: "NEEDS_ACTION",
  accepted: "ACCEPTED",
  declined: "DECLINED",
  tentative: "TENTATIVE",
};

/** The account the calendar belongs to, as Google marks it on the event. */
export function selfAddress(event: Json): string | null {
  const candidates = [
    record(event.organizer),
    record(event.creator),
    ...list(event.attendees).map(record),
  ];
  for (const person of candidates) {
    if (person?.self === true) {
      const email = text(person.email);
      if (email) return email.toLowerCase();
    }
  }
  return null;
}

function meetingUrlOf(event: Json): string | null {
  const hangout = text(event.hangoutLink);
  if (hangout) return hangout;
  const conference = record(event.conferenceData);
  for (const entry of list(conference?.entryPoints)) {
    const point = record(entry);
    if (point?.entryPointType === "video") {
      const uri = text(point.uri);
      if (uri) return uri;
    }
  }
  return null;
}

/** The original start of a changed occurrence: its recurrence id. */
function recurrenceIdOf(event: Json): string | null {
  if (!text(event.recurringEventId)) return null;
  const original = timeOf(event.originalStartTime);
  return original?.at ?? original?.date ?? null;
}

export function mapGoogleEvents(
  events: unknown,
  options: GoogleEventMapOptions,
): GoogleEventMapResult {
  const items: CalendarEventItem[] = [];
  const skipped: { index: number; reason: string }[] = [];
  list(events).forEach((entry, index) => {
    const event = record(entry);
    const sourceId = event ? text(event.id) : null;
    if (!event || !sourceId) {
      skipped.push({ index, reason: "no Google event id" });
      return;
    }
    const account =
      text(options.account)?.toLowerCase() ??
      selfAddress(event) ??
      options.calendarId.toLowerCase();
    const uid = text(event.iCalUID) ?? sourceId;
    const recurrenceId = recurrenceIdOf(event);
    const key = `cal:${account}:${uid}${recurrenceId ? `:${recurrenceId}` : ""}`;
    const start = timeOf(event.start);
    const end = timeOf(event.end);
    const status = STATUS[text(event.status) ?? "confirmed"] ?? "CONFIRMED";
    const summary = text(event.summary);
    const organizer = record(event.organizer);
    const capture: CalendarEventAction = {
      type: "CAPTURE_EVENT",
      input: {
        externalId: key,
        uid,
        recurrenceId,
        calendar: {
          id: options.calendarId,
          name: text(options.calendarName) ?? null,
          account,
        },
        source: "google",
        sourceId,
        sourceUrl: text(event.htmlLink),
        summary,
        description: text(event.description),
        location: text(event.location),
        meetingUrl: meetingUrlOf(event),
        start,
        end,
        allDay: Boolean(start?.date),
        status,
        busy: event.transparency !== "transparent",
        organizer: organizer
          ? {
              email: text(organizer.email),
              name: text(organizer.displayName),
            }
          : null,
        attendees: list(event.attendees).flatMap((a) => {
          const person = record(a);
          const email = person ? text(person.email) : null;
          if (!person || !email) return [];
          return [
            {
              email,
              name: text(person.displayName),
              response:
                RESPONSE[text(person.responseStatus) ?? ""] ?? "NEEDS_ACTION",
              optional: person.optional === true,
              organizer: person.organizer === true,
              self: person.self === true,
            },
          ];
        }),
        recurrence: list(event.recurrence).flatMap((r) => {
          const line = text(r);
          return line ? [line] : [];
        }),
        sourceUpdatedAt: (() => {
          const u = text(event.updated);
          return u && !Number.isNaN(Date.parse(u))
            ? new Date(Date.parse(u)).toISOString()
            : null;
        })(),
        capturedAt: options.capturedAt,
      },
    };
    items.push({
      key,
      name: eventName(summary),
      folder: text(options.calendarName) ?? account,
      status,
      start: start?.at ?? start?.date ?? null,
      actions: [capture],
      updateActions: [capture],
    });
  });
  return { items, skipped, count: items.length };
}

export const distyraGoogleEventToCalendarEventAction = createAction({
  // Saved workflows refer to the action by name: don't rename it once published
  name: "google-event-to-calendar-event",
  // Reaches nothing: this step is arithmetic on the trigger's output.
  requireAuth: false,
  displayName: "Google Calendar Events to Calendar Events",
  description: `Turn the Google Calendar trigger's event (or a list of events) into items for Upsert Documents: one per event, keyed cal:<account>:<UID>[:<recurrence-id>], with the CAPTURE_EVENT action a ${CALENDAR_EVENT_TYPE} document takes. In the upsert, set Items to this step's items, Item key to key, Document key to externalId, Document name to $item.name, Folder by name to $item.folder, Actions on create to $item.actions and Actions on update to $item.updateActions.`,
  props: {
    events: Property.Json({
      displayName: "Events",
      description:
        "The trigger's event, e.g. {{trigger}}, or a list of events.",
      required: true,
    }),
    calendarId: Property.ShortText({
      displayName: "Calendar",
      description: "The calendar id the trigger watches, e.g. primary.",
      required: true,
    }),
    calendarName: Property.ShortText({
      displayName: "Calendar name",
      required: false,
    }),
    account: Property.ShortText({
      displayName: "Account",
      description:
        "The account the calendar belongs to. Empty: read off the event (Google marks it as self).",
      required: false,
    }),
  },
  run(context) {
    const p = context.propsValue;
    return Promise.resolve(
      mapGoogleEvents(p.events, {
        calendarId: p.calendarId.trim(),
        calendarName: p.calendarName ?? null,
        account: p.account ?? null,
        capturedAt: new Date().toISOString(),
      }),
    );
  },
});
