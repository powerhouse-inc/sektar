// Reading the Calendar through its index rather than its documents
// (processors/calendar-index). Behind a remote drive the switchboard answers
// over GraphQL; with the drive in the tab's own reactor the same queries run
// live on its database. The week asks for the events that can fall in it and
// expands the series itself (editors/calendar/week.ts); an event document is
// loaded only when one is opened.
import {
  useReactorClient,
  useRelationalQuery,
} from "@powerhousedao/reactor-browser";
import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CALENDAR_EVENT_DOCUMENT_TYPE,
  CalendarIndex,
  calendarsQuery,
  eventsQuery,
  rangeOf,
  toCalendarRows,
  toEventRow,
  type CalendarEventListRow,
  type CalendarListRow,
  type CalendarRange,
  type CalendarRow,
  type DB,
} from "../../../processors/calendar-index/index.js";
import { indexGql as gql } from "./index-gql.js";
import { useMailIndexMode } from "./mail-index.js";

export type { CalendarEventListRow, CalendarListRow };

const EVENT_FIELDS = `id calendarKey calendarId calendarAccount calendarName calendarLabel title location meetingUrl startAt endAt startDate endDate timeZone allDay busy tentative status repeats recurrence recurrenceId uid seriesId seriesEnd organizerName organizerEmail updatedAt`;

const EVENTS_QUERY = `query ($d: String!, $f: String!, $t: String!) {
  calendarIndex { events(driveId: $d, from: $f, to: $t) { ${EVENT_FIELDS} } }
}`;

const CALENDARS_QUERY = `query ($d: String!) {
  calendarIndex { calendars(driveId: $d) { key label events } }
}`;

const DAY = 86_400_000;
/** A burst of event changes (a calendar sync) asks once, this long after the last. */
const SETTLE_MS = 800;
const POLL_MS = 30_000;
const RETRY_MS = 5_000;

/**
 * The range asked of the index: the week widened by a day each side. The
 * index keeps a whole-day event's dates as UTC midnight while the week reads
 * them as local midnight; the expansion cuts the range exactly.
 */
function askedRange(from: Date, to: Date): CalendarRange | null {
  return rangeOf(from.getTime() - DAY, to.getTime() + DAY);
}

/** The calendar event documents changed (an event synced, added or removed): `onChange` is called, settled. */
function useCalendarChanges(enabled: boolean, onChange: () => void): void {
  const client = useReactorClient();
  const ref = useRef(onChange);
  ref.current = onChange;
  useEffect(() => {
    if (!enabled || !client) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      clearTimeout(timer);
      timer = setTimeout(() => ref.current(), SETTLE_MS);
    };
    let stop: (() => void) | undefined;
    try {
      stop = client.subscribe({ type: CALENDAR_EVENT_DOCUMENT_TYPE }, settle);
    } catch {
      // no realtime channel: the poll still follows
    }
    return () => {
      clearTimeout(timer);
      stop?.();
    };
  }, [enabled, client]);
}

/** Answers this tab already has, by key: a week visited again paints at once. */
const answers = new Map<string, unknown>();
const ANSWERS_MAX = 24;

function remember(key: string, value: unknown): void {
  answers.delete(key);
  answers.set(key, value);
  while (answers.size > ANSWERS_MAX) {
    const oldest = answers.keys().next().value;
    if (oldest === undefined) break;
    answers.delete(oldest);
  }
}

/**
 * One remote index answer, asked when `key` changes, again shortly after an
 * event changes, and every half minute while the tab is visible. While a new
 * key is on its way the previous answer stays, so moving a week never blanks
 * the grid; `loaded` says whether the answer is for this key.
 */
function useRemoteValue<T>(options: {
  key: string;
  enabled: boolean;
  fetch: () => Promise<T>;
}): { value: T | undefined; loaded: boolean } {
  const { key, enabled } = options;
  const [answer, setAnswer] = useState<{ key: string; value: T } | null>(() =>
    answers.has(key) ? { key, value: answers.get(key) as T } : null,
  );
  const [tick, setTick] = useState(0);
  const fetchRef = useRef(options.fetch);
  fetchRef.current = options.fetch;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    fetchRef
      .current()
      .then((value) => {
        remember(key, value);
        if (active) setAnswer({ key, value });
      })
      .catch(() => {
        // keep what was known; ask again shortly
        if (active) retry = setTimeout(() => setTick((n) => n + 1), RETRY_MS);
      });
    return () => {
      active = false;
      clearTimeout(retry);
    };
  }, [key, enabled, tick]);

  const again = useCallback(() => setTick((n) => n + 1), []);
  useCalendarChanges(enabled, again);
  useEffect(() => {
    if (!enabled) return;
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") setTick((n) => n + 1);
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [enabled]);

  if (answer?.key === key) return { value: answer.value, loaded: true };
  if (answers.has(key)) return { value: answers.get(key) as T, loaded: true };
  return { value: answer?.value, loaded: false };
}

/* --------------------------------------------------------------- local */

type EventParams = { range: CalendarRange | null };
type EventQB = Parameters<
  Parameters<typeof useRelationalQuery<DB, CalendarRow, EventParams>>[2]
>[0];

type CalendarSourceRow = Parameters<typeof toCalendarRows>[0][number];
type CalendarQB = Parameters<
  Parameters<typeof useRelationalQuery<DB, CalendarSourceRow, undefined>>[2]
>[0];

/** An empty range for a disabled live query: it must still compile. */
const NOTHING: CalendarRange = {
  from: "1970-01-01T00:00:00.000Z",
  to: "1970-01-01T00:00:00.001Z",
};

function useLocalEvents(
  enabled: boolean,
  driveId: string | null,
  range: CalendarRange | null,
): CalendarEventListRow[] | undefined {
  const params = useMemo<EventParams>(
    () => ({ range: enabled ? range : null }),
    [enabled, range],
  );
  const build = useCallback(
    (db: EventQB, p?: EventParams) =>
      eventsQuery(db, (p ?? params).range ?? NOTHING).compile(),
    [params],
  );
  const q = useRelationalQuery<DB, CalendarRow, EventParams>(
    CalendarIndex,
    enabled ? (driveId ?? "") : "",
    build,
    params,
  );
  return useMemo(
    () => (enabled && q.result ? q.result.rows.map(toEventRow) : undefined),
    [enabled, q.result],
  );
}

function useLocalCalendars(
  enabled: boolean,
  driveId: string | null,
): CalendarListRow[] | undefined {
  const build = useCallback((db: CalendarQB) => calendarsQuery(db).compile(), []);
  const q = useRelationalQuery<DB, CalendarSourceRow, undefined>(
    CalendarIndex,
    enabled ? (driveId ?? "") : "",
    build,
  );
  return useMemo(
    () => (enabled && q.result ? toCalendarRows(q.result.rows) : undefined),
    [enabled, q.result],
  );
}

/* ---------------------------------------------------------------- api */

export interface CalendarEvents {
  /** The events that can show in the range; the last known answer while a new range loads. */
  rows: CalendarEventListRow[] | undefined;
  /** The rows answer this range. */
  loaded: boolean;
  mode: "remote" | "local" | "unknown";
}

/**
 * The events that can fall in [from, to): one-off events overlapping it, the
 * series that can produce an occurrence in it, and those series' changed
 * occurrences. Hand them to `occurrencesIn` through `sourceFromRow`.
 */
export function useCalendarEvents(
  drive: DocumentDriveDocument | undefined,
  from: Date,
  to: Date,
): CalendarEvents {
  const mode = useMailIndexMode(drive);
  const driveId = drive?.header.id ?? null;
  const base = mode.kind === "remote" ? mode.base : null;
  const fromMs = from.getTime();
  const toMs = to.getTime();
  const range = useMemo(
    () => askedRange(new Date(fromMs), new Date(toMs)),
    [fromMs, toMs],
  );
  const remote = useRemoteValue<CalendarEventListRow[]>({
    key: JSON.stringify(["events", base, driveId, range]),
    enabled: base !== null && driveId !== null && range !== null,
    fetch: async () => {
      if (!base || !driveId || !range) throw new Error("No switchboard for this drive");
      const data = await gql<{
        calendarIndex: { events: CalendarEventListRow[] };
      }>(base, EVENTS_QUERY, { d: driveId, f: range.from, t: range.to });
      return data.calendarIndex.events;
    },
  });
  const local = useLocalEvents(mode.kind === "local", driveId, range);
  if (mode.kind === "local")
    return { rows: local, loaded: local !== undefined, mode: mode.kind };
  return { rows: remote.value, loaded: remote.loaded, mode: mode.kind };
}

/** Every calendar in the drive with its label and event count; undefined until known. */
export function useCalendarList(
  drive: DocumentDriveDocument | undefined,
): CalendarListRow[] | undefined {
  const mode = useMailIndexMode(drive);
  const driveId = drive?.header.id ?? null;
  const base = mode.kind === "remote" ? mode.base : null;
  const remote = useRemoteValue<CalendarListRow[]>({
    key: JSON.stringify(["calendars", base, driveId]),
    enabled: base !== null && driveId !== null,
    fetch: async () => {
      if (!base || !driveId) throw new Error("No switchboard for this drive");
      const data = await gql<{ calendarIndex: { calendars: CalendarListRow[] } }>(
        base,
        CALENDARS_QUERY,
        { d: driveId },
      );
      return data.calendarIndex.calendars;
    },
  });
  const local = useLocalCalendars(mode.kind === "local", driveId);
  return mode.kind === "local" ? local : remote.value;
}
