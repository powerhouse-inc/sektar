// Turns a calendar event's state into its index row. Pure, shared by the
// processor and its tests. The state arrives as the operation's
// `resultingState`; no document is loaded. The rules follow the week view's
// own (editors/calendar/week.ts): what a calendar is, where an event starts
// and ends, what is tentative and what is a series.
import type { CalendarRow } from "./schema.js";

type Json = Record<string, unknown>;

const MINUTE = 60_000;
const DAY = 86_400_000;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const obj = (v: unknown): Json | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;

const objects = (v: unknown): Json[] =>
  Array.isArray(v)
    ? v.filter((x): x is Json => Boolean(x) && typeof x === "object")
    : [];

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** A yyyy-mm-dd date (the start of a longer string) as UTC midnight. */
function dateMs(v: string | null): number | null {
  const m = v ? /^(\d{4})-(\d{2})-(\d{2})/.exec(v) : null;
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

function instantMs(v: string | null): number | null {
  if (!v) return null;
  const ms = new Date(v).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** The calendar an event is on, as week.ts `calendarKey` names it. */
export function calendarKeyOf(calendar: Json | null): string {
  return `${str(calendar?.account) ?? ""}|${str(calendar?.id) ?? ""}`;
}

/** As week.ts `calendarLabel`. */
export function calendarLabelOf(calendar: Json | null): string {
  return (
    str(calendar?.name) ?? str(calendar?.account) ?? str(calendar?.id) ?? "Calendar"
  );
}

/**
 * Where the event sits, as week.ts `bounds`: a whole-day event from its
 * start date to its end date (a day when the end is missing or not after
 * the start), a timed one from its start to its end (half an hour when the
 * end is missing or not after the start). Null without a start.
 */
export function boundsOf(
  allDay: boolean,
  start: Json | null,
  end: Json | null,
): { start: number; end: number } | null {
  if (allDay) {
    const s = dateMs(str(start?.date));
    if (s === null) return null;
    const e = dateMs(str(end?.date));
    return { start: s, end: e !== null && e > s ? e : s + DAY };
  }
  const s = instantMs(str(start?.at));
  if (s === null) return null;
  const e = instantMs(str(end?.at));
  return { start: s, end: e !== null && e > s ? e : s + 30 * MINUTE };
}

/** As week.ts `tentativeOf`: tentative, or the account itself has not said yes. */
export function tentativeOf(status: string, attendees: readonly Json[]): boolean {
  if (status === "TENTATIVE") return true;
  const self = attendees.find((a) => a.self === true);
  return (
    !!self &&
    self.organizer !== true &&
    (self.response === "TENTATIVE" || self.response === "NEEDS_ACTION")
  );
}

/** An iCalendar date or date-time; read as UTC (a local one is off by hours, the margin covers it). */
function icalMs(v: string): number | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(v.trim());
  if (!m) return null;
  const [y, mo, d, h = "0", mi = "0", s = "0"] = m.slice(1, 7);
  const ms = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  );
  return Number.isNaN(ms) ? null : ms;
}

const FREQS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
type Freq = (typeof FREQS)[number];

export interface RuleBounds {
  freq: Freq;
  interval: number;
  count: number | null;
  until: number | null;
}

/** The parts of an RRULE line that bound a series; null when week.ts would not expand it. */
export function ruleOf(line: string): RuleBounds | null {
  if (!/^RRULE:/i.test(line)) return null;
  const parts = new Map(
    line
      .replace(/^RRULE:/i, "")
      .split(";")
      .map((kv) => {
        const [k, v = ""] = kv.split("=");
        return [k.toUpperCase(), v] as const;
      }),
  );
  const freq = FREQS.find((f) => f === parts.get("FREQ"));
  if (!freq) return null;
  const count = parts.has("COUNT") ? Number(parts.get("COUNT")) : NaN;
  const until = parts.get("UNTIL");
  return {
    freq,
    interval: Math.max(1, Number(parts.get("INTERVAL") ?? 1) || 1),
    count: Number.isFinite(count) && count >= 0 ? count : null,
    until: until ? icalMs(until) : null,
  };
}

/**
 * How far past its first start one period of each frequency reaches, times
 * the periods a COUNT can need: a monthly rule on the 31st or the fifth
 * Friday skips months, a yearly one on 29 February skips years.
 */
const PERIOD_REACH: Record<Freq, number> = {
  DAILY: DAY,
  WEEKLY: 7 * DAY,
  MONTHLY: 4 * 31 * DAY,
  YEARLY: 8 * 366 * DAY,
};

/**
 * An instant no occurrence of the series ends after: the earlier of UNTIL
 * and what COUNT can reach, plus the event's length and two days for the
 * zones UNTIL and the dates are read in. Null when the series never ends.
 */
export function seriesEndOf(
  rule: RuleBounds,
  start: number,
  length: number,
): number | null {
  const ends: number[] = [];
  if (rule.until !== null) ends.push(rule.until);
  if (rule.count !== null)
    ends.push(start + rule.count * rule.interval * PERIOD_REACH[rule.freq]);
  if (ends.length === 0) return null;
  return Math.max(start, Math.min(...ends)) + length + 2 * DAY;
}

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

/** The row for a calendar event's state, stamped `at`. */
export function rowFromState(
  documentId: string,
  state: Json,
  at: string,
): CalendarRow {
  const calendar = obj(state.calendar);
  const start = obj(state.start);
  const end = obj(state.end);
  const organizer = obj(state.organizer);
  const allDay = state.allDay === true;
  const status = str(state.status) ?? "CONFIRMED";
  const recurrence = strings(state.recurrence);
  const recurrenceId = str(state.recurrenceId);
  const uid = str(state.uid);
  const key = calendarKeyOf(calendar);
  const bounds = boundsOf(allDay, start, end);

  // A changed occurrence never repeats itself; a series is its first RRULE.
  const line = recurrenceId ? undefined : recurrence.find((l) => /^RRULE:/i.test(l));
  const rule = line ? ruleOf(line) : null;
  const seriesEnd =
    rule && bounds ? seriesEndOf(rule, bounds.start, bounds.end - bounds.start) : null;

  return {
    document_id: documentId,
    calendar_key: key,
    calendar_id: str(calendar?.id),
    calendar_account: str(calendar?.account),
    calendar_name: str(calendar?.name),
    calendar_label: calendarLabelOf(calendar),
    title: str(state.summary),
    location: str(state.location),
    meeting_url: str(state.meetingUrl),
    start_at: iso(bounds?.start ?? null),
    end_at: iso(bounds?.end ?? null),
    start_date: allDay ? (str(start?.date)?.slice(0, 10) ?? null) : null,
    end_date: allDay ? (str(end?.date)?.slice(0, 10) ?? null) : null,
    time_zone: str(start?.timeZone) ?? str(end?.timeZone),
    all_day: allDay,
    // As the week reads it: anything but busy is free time.
    busy: state.busy === true,
    tentative: tentativeOf(status, objects(state.attendees)),
    status,
    repeats: rule !== null,
    recurrence: JSON.stringify(recurrence),
    recurrence_id: recurrenceId,
    uid,
    series_id: uid ? `${key}|${uid}` : null,
    series_end: iso(seriesEnd),
    organizer_name: str(organizer?.name),
    organizer_email: str(organizer?.email),
    updated_at: at,
  };
}

/** The global state out of a `resultingState`; null when it cannot be read. */
export function parseState(json: string | undefined | null): Json | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object") {
      // resultingState is the scope's state; some transports wrap it per scope.
      const o = parsed as Json;
      return o.global && typeof o.global === "object" ? (o.global as Json) : o;
    }
  } catch {
    // not JSON: the caller leaves the row as it is
  }
  return null;
}
