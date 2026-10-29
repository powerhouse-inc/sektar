/**
 * What the calendar index writes for a document.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { describe, expect, it } from "vitest";
import { toEventRow } from "./queries.js";
import { parseState, rowFromState, ruleOf, seriesEndOf } from "./rows.js";

const AT = "2026-10-20T08:00:00.000Z";
const DAY = 86_400_000;

const timed = {
  summary: "  Sky weekly  ",
  description: "<p>Agenda</p>",
  location: "Room 4",
  meetingUrl: "https://meet.example/abc",
  allDay: false,
  busy: true,
  status: "CONFIRMED",
  calendar: { id: "primary", account: "me@x.be", name: "Work" },
  start: {
    at: "2026-10-26T09:00:00+01:00",
    date: null,
    timeZone: "Europe/Brussels",
  },
  end: { at: "2026-10-26T10:30:00+01:00", date: null, timeZone: null },
  organizer: { name: "Ann", email: "ann@x.be" },
  attendees: [
    {
      id: "me@x.be",
      email: "me@x.be",
      name: null,
      self: true,
      organizer: false,
      optional: false,
      response: "ACCEPTED",
    },
  ],
  recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20261231T000000Z", "EXDATE:20261102T080000Z"],
  recurrenceId: null,
  uid: "abc@google.com",
};

describe("rowFromState", () => {
  it("keeps what the week, the calendar list and the summary show", () => {
    const row = rowFromState("doc-1", timed, AT);
    expect(row).toMatchObject({
      document_id: "doc-1",
      calendar_key: "me@x.be|primary",
      calendar_id: "primary",
      calendar_account: "me@x.be",
      calendar_name: "Work",
      calendar_label: "Work",
      title: "Sky weekly",
      location: "Room 4",
      meeting_url: "https://meet.example/abc",
      start_at: "2026-10-26T08:00:00.000Z",
      end_at: "2026-10-26T09:30:00.000Z",
      start_date: null,
      end_date: null,
      time_zone: "Europe/Brussels",
      all_day: false,
      busy: true,
      tentative: false,
      status: "CONFIRMED",
      repeats: true,
      recurrence_id: null,
      uid: "abc@google.com",
      series_id: "me@x.be|primary|abc@google.com",
      organizer_name: "Ann",
      organizer_email: "ann@x.be",
      updated_at: AT,
    });
    expect(JSON.parse(row.recurrence)).toEqual(timed.recurrence);
    // UNTIL, the event's length and two days to spare
    expect(row.series_end).toBe(
      new Date(Date.parse("2026-12-31T00:00:00Z") + 90 * 60_000 + 2 * DAY).toISOString(),
    );
  });

  it("reads whole-day dates as UTC midnight and keeps the dates", () => {
    const row = rowFromState(
      "doc-2",
      {
        ...timed,
        allDay: true,
        recurrence: [],
        start: { at: null, date: "2026-10-28", timeZone: null },
        end: { at: null, date: "2026-10-30", timeZone: null },
      },
      AT,
    );
    expect(row.start_at).toBe("2026-10-28T00:00:00.000Z");
    expect(row.end_at).toBe("2026-10-30T00:00:00.000Z");
    expect(row.start_date).toBe("2026-10-28");
    expect(row.end_date).toBe("2026-10-30");
    expect(row.repeats).toBe(false);
    expect(row.series_end).toBeNull();
  });

  it("gives a missing or backward end the week's defaults", () => {
    const noEnd = rowFromState("a", { ...timed, recurrence: [], end: null }, AT);
    expect(noEnd.end_at).toBe("2026-10-26T08:30:00.000Z");
    const allDay = rowFromState(
      "b",
      {
        ...timed,
        allDay: true,
        start: { date: "2026-10-28" },
        end: { date: "2026-10-27" },
      },
      AT,
    );
    expect(allDay.end_at).toBe("2026-10-29T00:00:00.000Z");
  });

  it("has no instants without a start", () => {
    const row = rowFromState("c", { ...timed, start: null, end: null }, AT);
    expect(row.start_at).toBeNull();
    expect(row.end_at).toBeNull();
    expect(row.series_end).toBeNull();
  });

  it("marks tentative events and unanswered invitations", () => {
    expect(rowFromState("d", { ...timed, status: "TENTATIVE" }, AT).tentative).toBe(true);
    const invited = {
      ...timed,
      attendees: [{ ...timed.attendees[0], response: "NEEDS_ACTION" }],
    };
    expect(rowFromState("e", invited, AT).tentative).toBe(true);
    const organizing = {
      ...timed,
      attendees: [{ ...timed.attendees[0], organizer: true, response: "NEEDS_ACTION" }],
    };
    expect(rowFromState("f", organizing, AT).tentative).toBe(false);
  });

  it("treats a changed occurrence as one event of its series", () => {
    const row = rowFromState(
      "g",
      { ...timed, recurrenceId: "2026-11-09T08:00:00Z" },
      AT,
    );
    expect(row.repeats).toBe(false);
    expect(row.recurrence_id).toBe("2026-11-09T08:00:00Z");
    expect(row.series_id).toBe("me@x.be|primary|abc@google.com");
  });

  it("names a calendar by name, account, id, or not at all", () => {
    expect(rowFromState("h", { ...timed, calendar: null }, AT)).toMatchObject({
      calendar_key: "|",
      calendar_label: "Calendar",
    });
    expect(
      rowFromState("i", { ...timed, calendar: { id: "x", account: "a@b", name: null } }, AT)
        .calendar_label,
    ).toBe("a@b");
  });

  it("is free time unless busy", () => {
    expect(rowFromState("j", { ...timed, busy: false }, AT).busy).toBe(false);
    expect(rowFromState("k", { ...timed, busy: undefined }, AT).busy).toBe(false);
  });

  it("leaves a series without UNTIL or COUNT open", () => {
    const row = rowFromState("l", { ...timed, recurrence: ["RRULE:FREQ=DAILY"] }, AT);
    expect(row.repeats).toBe(true);
    expect(row.series_end).toBeNull();
    const odd = rowFromState("m", { ...timed, recurrence: ["RRULE:FREQ=HOURLY"] }, AT);
    expect(odd.repeats).toBe(false);
  });

  it("reads back in the subgraph's vocabulary", () => {
    const out = toEventRow(rowFromState("doc-1", timed, AT));
    expect(out).toMatchObject({
      id: "doc-1",
      calendarKey: "me@x.be|primary",
      allDay: false,
      repeats: true,
      recurrence: timed.recurrence,
    });
  });
});

describe("series bounds", () => {
  const start = Date.parse("2026-01-01T09:00:00Z");

  it("reaches past every occurrence COUNT can make", () => {
    const weekly = ruleOf("RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4")!;
    // four occurrences on two days a week end within two weeks; four weeks is a bound
    expect(seriesEndOf(weekly, start, 0)).toBe(start + 4 * 7 * DAY + 2 * DAY);
    const monthly = ruleOf("RRULE:FREQ=MONTHLY;BYMONTHDAY=31;COUNT=3;INTERVAL=2")!;
    expect(seriesEndOf(monthly, start, 0)! - start).toBeGreaterThan(3 * 2 * 31 * DAY);
  });

  it("takes the earlier of UNTIL and COUNT", () => {
    const rule = ruleOf("RRULE:FREQ=DAILY;COUNT=100;UNTIL=20260105")!;
    expect(seriesEndOf(rule, start, DAY)).toBe(Date.parse("2026-01-05T00:00:00Z") + 3 * DAY);
  });
});

describe("parseState", () => {
  it("reads a bare or a per-scope state", () => {
    expect(parseState(JSON.stringify({ summary: "x" }))).toEqual({ summary: "x" });
    expect(parseState(JSON.stringify({ global: { summary: "y" } }))).toEqual({
      summary: "y",
    });
    expect(parseState("not json")).toBeNull();
    expect(parseState(undefined)).toBeNull();
  });
});
