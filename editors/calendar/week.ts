/**
 * The week view as data: which events fall in a week (a repeating series
 * expanded, its changed and cancelled occurrences applied), where each one
 * sits in the time grid or the all-day row, and how times read. Pure: the
 * view renders what this returns. Times are the browser's local time.
 */
import type { CalendarEventState } from "document-models/calendar-event";

export type WeekStart = 0 | 1 | 6;
export type HourFormat = "24" | "12";

/** One occurrence of an event, as the week shows it */
export type Occurrence = {
  /** Unique within the week: the document and the occurrence's start */
  key: string;
  documentId: string;
  calendar: string;
  title: string;
  start: Date;
  /** Exclusive */
  end: Date;
  allDay: boolean;
  /** Free time (busy: false), shown like the design system's holidays */
  free: boolean;
  /** Not settled: the event is tentative, or the person has not said yes */
  tentative: boolean;
  repeats: boolean;
  state: CalendarEventState;
};

export type CalendarSource = {
  documentId: string;
  state: CalendarEventState;
};

const DAY = 86_400_000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + n,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  );
}

export function weekStartOf(d: Date, first: WeekStart): Date {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() - first + 7) % 7));
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isWeekend(d: Date): boolean {
  return d.getDay() === 0 || d.getDay() === 6;
}

/** yyyy-mm-dd as local midnight */
export function parseDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function parseAt(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The calendar an event is on: its account and calendar id */
export function calendarKey(state: CalendarEventState): string {
  const c = state.calendar;
  return `${c?.account ?? ""}|${c?.id ?? ""}`;
}

export function calendarLabel(state: CalendarEventState): string {
  const c = state.calendar;
  return c?.name || c?.account || c?.id || "Calendar";
}

function bounds(state: CalendarEventState): { start: Date; end: Date } | null {
  if (state.allDay) {
    const start = state.start?.date ? parseDate(state.start.date) : null;
    if (!start) return null;
    const end = state.end?.date ? parseDate(state.end.date) : null;
    return { start, end: end && end > start ? end : addDays(start, 1) };
  }
  const start = parseAt(state.start?.at);
  if (!start) return null;
  const end = parseAt(state.end?.at);
  return {
    start,
    end: end && end > start ? end : new Date(start.getTime() + 30 * 60_000),
  };
}

function tentativeOf(state: CalendarEventState): boolean {
  if (state.status === "TENTATIVE") return true;
  const self = state.attendees.find((a) => a.self);
  return (
    !!self &&
    !self.organizer &&
    (self.response === "TENTATIVE" || self.response === "NEEDS_ACTION")
  );
}

/* ------------------------------------------------------------- recurrence */

type Rule = {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  count: number | null;
  until: Date | null;
  /** [nth (0 = every), weekday 0-6] */
  byDay: [number, number][];
  byMonthDay: number[];
  byMonth: number[];
};

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** An iCalendar date or date-time value: Z is UTC, otherwise local wall-clock */
export function parseIcalTime(v: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(
    v.trim(),
  );
  if (!m) return null;
  const [y, mo, d, h = "0", mi = "0", s = "0"] = m.slice(1, 7);
  const parts = [
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s),
  ] as const;
  return m[7] ? new Date(Date.UTC(...parts)) : new Date(...parts);
}

export function parseRule(line: string): Rule | null {
  const body = line.replace(/^RRULE:/i, "");
  const p = new Map(
    body.split(";").map((kv) => {
      const [k, v = ""] = kv.split("=");
      return [k.toUpperCase(), v] as const;
    }),
  );
  const freq = p.get("FREQ");
  if (
    freq !== "DAILY" &&
    freq !== "WEEKLY" &&
    freq !== "MONTHLY" &&
    freq !== "YEARLY"
  )
    return null;
  const list = (k: string) => (p.get(k) ?? "").split(",").filter(Boolean);
  return {
    freq,
    interval: Math.max(1, Number(p.get("INTERVAL") ?? 1) || 1),
    count: p.has("COUNT") ? Number(p.get("COUNT")) : null,
    until: p.has("UNTIL") ? parseIcalTime(p.get("UNTIL")!) : null,
    byDay: list("BYDAY")
      .map((s) => /^([+-]?\d+)?([A-Z]{2})$/.exec(s))
      .filter((m): m is RegExpExecArray => !!m && WEEKDAYS.includes(m[2]))
      .map(
        (m) => [Number(m[1] ?? 0), WEEKDAYS.indexOf(m[2])] as [number, number],
      ),
    byMonthDay: list("BYMONTHDAY").map(Number).filter(Boolean),
    byMonth: list("BYMONTH").map(Number).filter(Boolean),
  };
}

function withTime(day: Date, time: Date): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
  );
}

/** The days of one month that match nth-weekday / month-day rules */
function monthDays(
  year: number,
  month: number,
  rule: Rule,
  anchor: Date,
): Date[] {
  const last = new Date(year, month + 1, 0).getDate();
  const days = new Set<number>();
  if (rule.byDay.length > 0) {
    for (const [nth, wd] of rule.byDay) {
      const matches: number[] = [];
      for (let d = 1; d <= last; d++)
        if (new Date(year, month, d).getDay() === wd) matches.push(d);
      if (nth === 0) matches.forEach((d) => days.add(d));
      else {
        const d = nth > 0 ? matches[nth - 1] : matches[matches.length + nth];
        if (d) days.add(d);
      }
    }
  } else if (rule.byMonthDay.length > 0) {
    for (const md of rule.byMonthDay) {
      const d = md > 0 ? md : last + 1 + md;
      if (d >= 1 && d <= last) days.add(d);
    }
  } else if (anchor.getDate() <= last) {
    days.add(anchor.getDate());
  }
  return [...days].sort((a, b) => a - b).map((d) => new Date(year, month, d));
}

/**
 * The starts of a series that begin before `to`, in order, honouring COUNT
 * and UNTIL from the first one. The first start is always the series' own.
 */
export function expandRule(rule: Rule, first: Date, to: Date): Date[] {
  const out: Date[] = [];
  const done = (d: Date) =>
    d >= to ||
    (rule.until !== null && d > rule.until) ||
    (rule.count !== null && out.length >= rule.count);
  const push = (d: Date) => {
    if (d < first) return false;
    if (done(d)) return true;
    out.push(d);
    return false;
  };
  for (let period = 0; period < 20_000; period++) {
    let candidates: Date[];
    if (rule.freq === "DAILY") {
      candidates = [addDays(first, period * rule.interval)];
    } else if (rule.freq === "WEEKLY") {
      const week = addDays(
        startOfDay(first),
        period * 7 * rule.interval - ((first.getDay() + 6) % 7),
      );
      const wds =
        rule.byDay.length > 0
          ? rule.byDay.map(([, wd]) => wd)
          : [first.getDay()];
      candidates = [...new Set(wds)]
        .map((wd) => withTime(addDays(week, (wd + 6) % 7), first))
        .sort((a, b) => a.getTime() - b.getTime());
    } else if (rule.freq === "MONTHLY") {
      const m = new Date(
        first.getFullYear(),
        first.getMonth() + period * rule.interval,
        1,
      );
      candidates = monthDays(m.getFullYear(), m.getMonth(), rule, first).map(
        (d) => withTime(d, first),
      );
    } else {
      const year = first.getFullYear() + period * rule.interval;
      const months =
        rule.byMonth.length > 0
          ? rule.byMonth.map((m) => m - 1)
          : [first.getMonth()];
      candidates = months
        .sort((a, b) => a - b)
        .flatMap((month) =>
          monthDays(
            year,
            month,
            rule.byDay.length > 0 || rule.byMonthDay.length > 0
              ? rule
              : { ...rule, byDay: [], byMonthDay: [first.getDate()] },
            first,
          ),
        )
        .map((d) => withTime(d, first));
    }
    for (const c of candidates) if (push(c)) return out;
    const lastCandidate = candidates[candidates.length - 1];
    if (lastCandidate && done(lastCandidate)) return out;
  }
  return out;
}

/** EXDATE lines as comparable keys: instants for times, local dates for dates */
function exclusions(lines: string[]): Set<string> {
  const out = new Set<string>();
  for (const line of lines) {
    const m = /^EXDATE([^:]*):(.*)$/i.exec(line);
    if (!m) continue;
    const isDate = /VALUE=DATE(?!-)/i.test(m[1]);
    for (const v of m[2].split(",")) {
      const d = parseIcalTime(v);
      if (d) out.add(isDate ? dayKey(d) : String(d.getTime()));
    }
  }
  return out;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** A recurrence id as the same key: an instant, or a date for whole-day series */
function recurrenceKey(id: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) {
    const d = parseDate(id);
    return d ? dayKey(d) : null;
  }
  const d = parseAt(id);
  return d ? String(d.getTime()) : null;
}

/* ------------------------------------------------------------ occurrences */

/**
 * Every occurrence that overlaps [from, to): one-off events, a series'
 * occurrences minus its exceptions, and changed occurrences in their own
 * place. Cancelled ones are left out.
 */
export function occurrencesIn(
  sources: CalendarSource[],
  from: Date,
  to: Date,
): Occurrence[] {
  const series = new Map<string, { overrides: Set<string> }>();
  const seriesId = (s: CalendarEventState) =>
    `${calendarKey(s)}|${s.uid ?? ""}`;
  for (const { state } of sources) {
    if (!state.recurrenceId || !state.uid) continue;
    const key = recurrenceKey(state.recurrenceId);
    if (!key) continue;
    const entry = series.get(seriesId(state)) ?? {
      overrides: new Set<string>(),
    };
    entry.overrides.add(key);
    series.set(seriesId(state), entry);
  }

  const out: Occurrence[] = [];
  for (const { documentId, state } of sources) {
    if (state.status === "CANCELLED") continue;
    const b = bounds(state);
    if (!b) continue;
    const base = {
      documentId,
      calendar: calendarKey(state),
      title: state.summary?.trim() || "(no title)",
      allDay: state.allDay,
      free: !state.busy,
      tentative: tentativeOf(state),
      state,
    };
    const rules = state.recurrenceId
      ? []
      : state.recurrence.filter((l) => /^RRULE:/i.test(l));
    const rule = rules.length > 0 ? parseRule(rules[0]) : null;
    if (!rule) {
      if (b.start < to && b.end > from) {
        out.push({
          ...base,
          key: `${documentId}@${b.start.getTime()}`,
          start: b.start,
          end: b.end,
          repeats: !!state.recurrenceId,
        });
      }
      continue;
    }
    const length = b.end.getTime() - b.start.getTime();
    const skip = exclusions(state.recurrence);
    const overridden =
      series.get(seriesId(state))?.overrides ?? new Set<string>();
    for (const start of expandRule(rule, b.start, to)) {
      const end = state.allDay
        ? addDays(start, Math.round(length / DAY))
        : new Date(start.getTime() + length);
      if (end <= from) continue;
      const keys = [String(start.getTime()), dayKey(start)];
      if (keys.some((k) => skip.has(k) || overridden.has(k))) continue;
      out.push({
        ...base,
        key: `${documentId}@${start.getTime()}`,
        start,
        end,
        repeats: true,
      });
    }
  }
  return out.sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      b.end.getTime() - a.end.getTime(),
  );
}

/* ----------------------------------------------------------------- layout */

/** In the all-day row: whole-day events, and timed ones of a day or longer */
export function inAllDayRow(o: Occurrence): boolean {
  return o.allDay || o.end.getTime() - o.start.getTime() >= DAY;
}

export type AllDayItem = {
  occurrence: Occurrence;
  column: number;
  span: number;
  row: number;
};

/** Places all-day items on the visible days: 0-based column, span, and a row so none overlap */
export function layoutAllDay(
  occurrences: Occurrence[],
  days: Date[],
): AllDayItem[] {
  const rows: number[][] = [];
  const out: AllDayItem[] = [];
  for (const o of occurrences.filter(inAllDayRow)) {
    const cols = days
      .map((d, i) => (o.start < addDays(d, 1) && o.end > d ? i : -1))
      .filter((i) => i >= 0);
    if (cols.length === 0) continue;
    const column = cols[0];
    const span = cols[cols.length - 1] - column + 1;
    let row = rows.findIndex((taken) =>
      taken.every((c) => c < column || c >= column + span),
    );
    if (row < 0) row = rows.push([]) - 1;
    for (let c = column; c < column + span; c++) rows[row].push(c);
    out.push({ occurrence: o, column, span, row });
  }
  return out;
}

export type TimedItem = {
  occurrence: Occurrence;
  /** Hours from the day's midnight */
  start: number;
  duration: number;
  col: number;
  cols: number;
};

/**
 * The timed events of one day, side by side where they overlap: each group
 * of overlapping events shares its width among as many columns as it needs.
 */
export function layoutDay(occurrences: Occurrence[], day: Date): TimedItem[] {
  const next = addDays(day, 1);
  const items = occurrences
    .filter((o) => !inAllDayRow(o) && o.start < next && o.end > day)
    .map((o) => {
      const s = Math.max(o.start.getTime(), day.getTime());
      const e = Math.min(o.end.getTime(), next.getTime());
      const start = (s - day.getTime()) / 3_600_000;
      // At least a quarter hour, so a short event stays readable
      return {
        occurrence: o,
        start,
        duration: Math.max(0.25, (e - s) / 3_600_000),
        col: 0,
        cols: 1,
      };
    })
    .sort((a, b) => a.start - b.start || b.duration - a.duration);

  let group: TimedItem[] = [];
  let groupEnd = -1;
  const close = () => {
    const n = Math.max(1, ...group.map((g) => g.col + 1));
    for (const g of group) g.cols = n;
    group = [];
  };
  for (const item of items) {
    if (item.start >= groupEnd) {
      close();
      groupEnd = -1;
    }
    const ends: number[] = [];
    for (const g of group)
      ends[g.col] = Math.max(ends[g.col] ?? -1, g.start + g.duration);
    let col = ends.findIndex((e) => e <= item.start);
    if (col < 0) col = ends.length;
    item.col = col;
    group.push(item);
    groupEnd = Math.max(groupEnd, item.start + item.duration);
  }
  close();
  return items;
}

/** The hours the grid shows: the design system's 8–19, widened to fit the week's events */
export function hourRange(
  items: TimedItem[],
  workHours: boolean,
): { from: number; to: number } {
  if (workHours) return { from: WORK_FROM, to: WORK_TO };
  let from = 8;
  let to = 19;
  for (const i of items) {
    from = Math.min(from, Math.floor(i.start));
    to = Math.max(to, Math.ceil(i.start + i.duration));
  }
  return { from, to: Math.min(24, to) };
}

export const WORK_FROM = 9;
export const WORK_TO = 18;

/* ----------------------------------------------------------------- words */

function two(n: number): string {
  return (n < 10 ? "0" : "") + n;
}

/** As the design system formats it: 9:00 / 9:30 AM; `bare` drops AM/PM */
export function formatHour(h: number, mode: HourFormat, bare = false): string {
  let hh = Math.floor(h);
  let mm = Math.round((h - hh) * 60);
  if (mm === 60) {
    hh += 1;
    mm = 0;
  }
  hh %= 24;
  if (mode === "24") return `${hh}:${two(mm)}`;
  const t = `${hh % 12 || 12}${mm ? `:${two(mm)}` : ""}`;
  return bare ? t : `${t} ${hh < 12 ? "AM" : "PM"}`;
}

export function hoursOf(d: Date): number {
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/** 10:00 – 11:30; in 12-hour time the first AM/PM goes when both share it */
export function formatRange(start: Date, end: Date, mode: HourFormat): string {
  const a = hoursOf(start);
  const b = sameDay(start, end) || hoursOf(end) > 0 ? hoursOf(end) : 24;
  const same = mode === "12" && a < 12 === b % 24 < 12;
  return `${formatHour(a, mode, same)} – ${formatHour(b, mode)}`;
}

const LONG_DAY = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Thursday 29 October, or Thursday 29 October – Friday 30 October */
export function formatDays(o: Occurrence): string {
  const lastDay = o.allDay ? addDays(o.end, -1) : o.end;
  const first = LONG_DAY.format(o.start);
  if (
    sameDay(o.start, lastDay) ||
    (!o.allDay && hoursOf(o.end) === 0 && sameDay(o.start, addDays(o.end, -1)))
  ) {
    return first;
  }
  return `${first} – ${LONG_DAY.format(lastDay)}`;
}

const MONTH = new Intl.DateTimeFormat(undefined, { month: "long" });
const MONTH_SHORT = new Intl.DateTimeFormat(undefined, { month: "short" });

/** The toolbar title: October 26 – November 1, 2026; short: Oct 26 – Nov 1 */
export function weekTitle(days: Date[]): {
  long: string;
  year: string;
  short: string;
} {
  const a = days[0];
  const b = days[days.length - 1];
  const sameMonth = a.getMonth() === b.getMonth();
  return {
    long: sameMonth
      ? `${MONTH.format(a)} ${a.getDate()} – ${b.getDate()}`
      : `${MONTH.format(a)} ${a.getDate()} – ${MONTH.format(b)} ${b.getDate()}`,
    year:
      a.getFullYear() === b.getFullYear()
        ? String(b.getFullYear())
        : `${a.getFullYear()} – ${b.getFullYear()}`,
    short: sameMonth
      ? `${MONTH_SHORT.format(a)} ${a.getDate()} – ${b.getDate()}`
      : `${MONTH_SHORT.format(a)} ${a.getDate()} – ${MONTH_SHORT.format(b)} ${b.getDate()}`,
  };
}

/** How a series repeats, in words; null when it does not */
export function describeRepeat(state: CalendarEventState): string | null {
  const line = state.recurrence.find((l) => /^RRULE:/i.test(l));
  const rule = line ? parseRule(line) : null;
  if (!rule) return null;
  const every = (one: string, many: string) =>
    rule.interval === 1 ? `Every ${one}` : `Every ${rule.interval} ${many}`;
  const names = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  if (rule.freq === "DAILY") return every("day", "days");
  if (rule.freq === "WEEKLY") {
    const wds = rule.byDay.map(([, wd]) => wd);
    if (
      rule.interval === 1 &&
      wds.length === 5 &&
      [1, 2, 3, 4, 5].every((d) => wds.includes(d))
    )
      return "Every weekday";
    if (wds.length > 1)
      return `${every("week", "weeks")} on ${wds.map((d) => names[d]).join(", ")}`;
    return every("week", "weeks");
  }
  if (rule.freq === "MONTHLY") return every("month", "months");
  return every("year", "years");
}

/** The calendar colour slot, sk-cal-c1…c6, by the calendar's place in the list */
export function colourSlot(index: number): string {
  return `sk-cal-c${(index % 6) + 1}`;
}

/** The weeks of the month containing `month`, starting on `first`: whole weeks, as many as it spans */
export function monthGrid(month: Date, first: WeekStart): Date[] {
  const start = weekStartOf(
    new Date(month.getFullYear(), month.getMonth(), 1),
    first,
  );
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const days =
    Math.round((startOfDay(last).getTime() - start.getTime()) / DAY) + 1;
  return Array.from({ length: Math.ceil(days / 7) * 7 }, (_, i) =>
    addDays(start, i),
  );
}
