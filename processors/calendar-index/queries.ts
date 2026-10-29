// The questions the Calendar app asks of the calendar index, as queries over
// it. Shared by the subgraph (the switchboard answers Connect over GraphQL)
// and by a tab whose own reactor runs the processor (a live query), so the
// two never disagree on which events can fall in a week.
// The declarations name kysely's builder types (these queries return them):
// importing the package lets tsc refer to "kysely", not to a path into .pnpm.
import type {} from "kysely";
import type { IRelationalDb } from "@powerhousedao/reactor-browser";
import type { CalendarRow, DB } from "./schema.js";

/** What both a namespaced query builder and a Kysely instance offer. */
export type CalendarQueryBuilder = Pick<IRelationalDb<DB>, "selectFrom">;

/** At most this many rows answer one range: a week is tens, a series backlog hundreds. */
export const CALENDAR_EVENTS_MAX = 5000;

/** [from, to) as UTC instants in the stored form (toISOString), so text compares as time. */
export interface CalendarRange {
  from: string;
  to: string;
}

/** A range from whatever the caller sent; null when either end is not a time or the range is empty. */
export function rangeOf(
  from: string | number | Date | null | undefined,
  to: string | number | Date | null | undefined,
): CalendarRange | null {
  if (from == null || to == null) return null;
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a)
    return null;
  return { from: a.toISOString(), to: b.toISOString() };
}

/**
 * Every event that can show in [from, to): a one-off event (or a changed
 * occurrence) that overlaps it, a series that starts before `to` and does
 * not end before `from`, and every changed occurrence of such a series,
 * wherever it moved to (its original start is what the series skips).
 * The week view expands the series itself (editors/calendar/week.ts).
 *
 * A whole-day event's dates are stored as UTC midnight while the browser
 * reads them as its own midnight: a caller widens the range by a day on
 * each side and lets the expansion cut it exactly.
 */
export function eventsQuery(db: CalendarQueryBuilder, range: CalendarRange) {
  const { from, to } = range;
  return db
    .selectFrom("calendar_index")
    .selectAll()
    .where((eb) =>
      eb.or([
        eb.and([
          eb("repeats", "=", false),
          eb("start_at", "<", to),
          eb("end_at", ">", from),
        ]),
        eb.and([
          eb("repeats", "=", true),
          eb("start_at", "<", to),
          eb.or([eb("series_end", "is", null), eb("series_end", ">", from)]),
        ]),
        eb.and([
          eb("recurrence_id", "is not", null),
          eb(
            "series_id",
            "in",
            eb
              .selectFrom("calendar_index as s")
              .select("s.series_id")
              .where("s.repeats", "=", true)
              .where("s.series_id", "is not", null)
              .where("s.start_at", "<", to)
              .where((sb) =>
                sb.or([
                  sb("s.series_end", "is", null),
                  sb("s.series_end", ">", from),
                ]),
              ),
          ),
        ]),
      ]),
    )
    .orderBy("start_at", "asc")
    .orderBy("document_id", "asc")
    .limit(CALENDAR_EVENTS_MAX);
}

/** Every calendar in the drive with its label and how many events it holds. */
export function calendarsQuery(db: CalendarQueryBuilder) {
  return db
    .selectFrom("calendar_index")
    .select((eb) => [
      "calendar_key",
      eb.fn.max("calendar_label").as("label"),
      eb.fn.countAll<number>().as("events"),
    ])
    .groupBy("calendar_key");
}

/** An event as the week reads it: the row, in the subgraph's vocabulary. */
export interface CalendarEventListRow {
  id: string;
  calendarKey: string;
  calendarId: string | null;
  calendarAccount: string | null;
  calendarName: string | null;
  calendarLabel: string;
  title: string | null;
  location: string | null;
  meetingUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  startDate: string | null;
  endDate: string | null;
  timeZone: string | null;
  allDay: boolean;
  busy: boolean;
  tentative: boolean;
  status: string;
  repeats: boolean;
  recurrence: string[];
  recurrenceId: string | null;
  uid: string | null;
  seriesId: string | null;
  seriesEnd: string | null;
  organizerName: string | null;
  organizerEmail: string | null;
  updatedAt: string;
}

export interface CalendarListRow {
  key: string;
  label: string;
  /** Events in the index on this calendar (a series counts once). */
  events: number;
}

function parseLines(text: string): string[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** A stored row in the week's vocabulary. */
export function toEventRow(r: CalendarRow): CalendarEventListRow {
  return {
    id: r.document_id,
    calendarKey: r.calendar_key,
    calendarId: r.calendar_id,
    calendarAccount: r.calendar_account,
    calendarName: r.calendar_name,
    calendarLabel: r.calendar_label,
    title: r.title,
    location: r.location,
    meetingUrl: r.meeting_url,
    startAt: r.start_at,
    endAt: r.end_at,
    startDate: r.start_date,
    endDate: r.end_date,
    timeZone: r.time_zone,
    allDay: Boolean(r.all_day),
    busy: Boolean(r.busy),
    tentative: Boolean(r.tentative),
    status: r.status,
    repeats: Boolean(r.repeats),
    recurrence: parseLines(r.recurrence),
    recurrenceId: r.recurrence_id,
    uid: r.uid,
    seriesId: r.series_id,
    seriesEnd: r.series_end,
    organizerName: r.organizer_name,
    organizerEmail: r.organizer_email,
    updatedAt: r.updated_at,
  };
}

/** `calendarsQuery`'s rows as the calendar list reads them. */
export function toCalendarRows(
  rows: readonly {
    calendar_key: string;
    label: string | null;
    events: number | string | bigint;
  }[],
): CalendarListRow[] {
  return rows.map((r) => ({
    key: r.calendar_key,
    label: r.label ?? "Calendar",
    events: Number(r.events),
  }));
}
