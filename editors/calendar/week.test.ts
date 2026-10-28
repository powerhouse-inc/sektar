import { utils, type CalendarEventState } from "document-models/calendar-event";
import { describe, expect, it } from "vitest";
import {
  addDays,
  describeRepeat,
  expandRule,
  formatHour,
  formatRange,
  hourRange,
  layoutAllDay,
  layoutDay,
  monthGrid,
  occurrencesIn,
  parseRule,
  weekStartOf,
  weekTitle,
  type CalendarSource,
} from "./week.js";

// Local times throughout: the view shows the browser's time zone
const at = (y: number, m: number, d: number, h = 0, mi = 0) =>
  new Date(y, m - 1, d, h, mi);
const iso = (d: Date) => d.toISOString();

function event(
  partial: Partial<CalendarEventState>,
  id = "doc",
): CalendarSource {
  return {
    documentId: id,
    state: {
      ...utils.createDocument().state.global,
      calendar: { id: "primary", name: "Me", account: "me@x.be" },
      uid: `${id}@google.com`,
      ...partial,
    },
  };
}

const timed = (start: Date, end: Date) => ({
  start: { at: iso(start), date: null, timeZone: null },
  end: { at: iso(end), date: null, timeZone: null },
});

const MON = at(2026, 10, 26);
const NEXT_MON = addDays(MON, 7);

describe("the week", () => {
  it("starts on the chosen day", () => {
    const wed = at(2026, 10, 28, 15);
    expect(weekStartOf(wed, 1)).toEqual(MON);
    expect(weekStartOf(wed, 0)).toEqual(at(2026, 10, 25));
    expect(weekStartOf(wed, 6)).toEqual(at(2026, 10, 24));
    const days = Array.from({ length: 7 }, (_, i) => addDays(MON, i));
    expect(weekTitle(days).short).toMatch(/26 – .*1$/);
    expect(weekTitle(days).year).toBe("2026");
  });

  it("builds a mini month of whole weeks", () => {
    const grid = monthGrid(at(2026, 10, 1), 1);
    expect(grid[0]).toEqual(at(2026, 9, 28));
    expect(grid.length).toBe(35);
    expect(grid.at(-1)).toEqual(at(2026, 11, 1));
  });
});

describe("occurrences in a week", () => {
  it("takes one-off events that overlap the week and leaves out cancelled ones", () => {
    const list = occurrencesIn(
      [
        event(
          {
            summary: "In",
            ...timed(at(2026, 10, 28, 10), at(2026, 10, 28, 11)),
          },
          "a",
        ),
        event(
          {
            summary: "Before",
            ...timed(at(2026, 10, 20, 10), at(2026, 10, 20, 11)),
          },
          "b",
        ),
        event(
          {
            summary: "Gone",
            status: "CANCELLED",
            ...timed(at(2026, 10, 28, 12), at(2026, 10, 28, 13)),
          },
          "c",
        ),
        event(
          { summary: null, ...timed(at(2026, 10, 29, 9), at(2026, 10, 29, 9)) },
          "d",
        ),
      ],
      MON,
      NEXT_MON,
    );
    expect(list.map((o) => o.title)).toEqual(["In", "(no title)"]);
    // A zero-length event still gets half an hour
    expect(list[1].end.getTime() - list[1].start.getTime()).toBe(30 * 60_000);
  });

  it("expands a weekly series, minus its exceptions, with a changed occurrence in its own place", () => {
    const series = event(
      {
        summary: "Stand-up",
        ...timed(at(2026, 10, 5, 9), at(2026, 10, 5, 9, 30)),
        recurrence: [
          "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
          `EXDATE:${iso(at(2026, 10, 27, 9))
            .replace(/[-:]/g, "")
            .replace(/\.\d+/, "")}`,
        ],
      },
      "s",
    );
    const moved = event(
      {
        summary: "Stand-up (moved)",
        uid: "s@google.com",
        recurrenceId: iso(at(2026, 10, 28, 9)),
        ...timed(at(2026, 10, 28, 10), at(2026, 10, 28, 10, 30)),
      },
      "m",
    );
    const cancelled = event(
      {
        uid: "s@google.com",
        status: "CANCELLED",
        recurrenceId: iso(at(2026, 10, 29, 9)),
      },
      "x",
    );
    const list = occurrencesIn([series, moved, cancelled], MON, NEXT_MON);
    expect(
      list.map((o) => [o.title, o.start.getDate(), o.start.getHours()]),
    ).toEqual([
      ["Stand-up", 26, 9],
      ["Stand-up (moved)", 28, 10],
      ["Stand-up", 30, 9],
    ]);
    expect(list.every((o) => o.repeats)).toBe(true);
    expect(describeRepeat(series.state)).toBe("Every weekday");
  });

  it("repeats whole-day events by date, and stops at COUNT and UNTIL", () => {
    const birthday = event({
      allDay: true,
      start: { at: null, date: "2020-10-30", timeZone: null },
      end: { at: null, date: "2020-10-31", timeZone: null },
      recurrence: ["RRULE:FREQ=YEARLY"],
    });
    const [o] = occurrencesIn([birthday], MON, NEXT_MON);
    expect(o.start).toEqual(at(2026, 10, 30));
    expect(o.end).toEqual(at(2026, 10, 31));

    const first = at(2026, 10, 1, 8);
    expect(
      expandRule(parseRule("RRULE:FREQ=DAILY;COUNT=3")!, first, at(2027, 1, 1)),
    ).toHaveLength(3);
    expect(
      expandRule(
        parseRule("RRULE:FREQ=DAILY;INTERVAL=2;UNTIL=20261007T235959Z")!,
        first,
        at(2027, 1, 1),
      ).map((d) => d.getDate()),
    ).toEqual([1, 3, 5, 7]);
    expect(
      expandRule(
        parseRule("RRULE:FREQ=MONTHLY;BYDAY=-1FR")!,
        first,
        at(2027, 1, 1),
      ).map((d) => d.getDate()),
    ).toEqual([30, 27, 25]);
    expect(
      expandRule(
        parseRule("RRULE:FREQ=MONTHLY;BYMONTHDAY=31")!,
        first,
        at(2027, 1, 1),
      ).map((d) => d.getMonth() + 1),
    ).toEqual([10, 12]);
    expect(parseRule("RRULE:FREQ=HOURLY")).toBeNull();
  });

  it("marks free time, and an invitation not answered yes as tentative", () => {
    const [free, maybe] = occurrencesIn(
      [
        event(
          { busy: false, ...timed(at(2026, 10, 26, 9), at(2026, 10, 26, 10)) },
          "f",
        ),
        event(
          {
            ...timed(at(2026, 10, 26, 11), at(2026, 10, 26, 12)),
            attendees: [
              {
                id: "me@x.be",
                email: "me@x.be",
                name: null,
                response: "NEEDS_ACTION",
                optional: false,
                organizer: false,
                self: true,
              },
            ],
          },
          "t",
        ),
      ],
      MON,
      NEXT_MON,
    );
    expect([free.free, free.tentative, maybe.tentative]).toEqual([
      true,
      false,
      true,
    ]);
  });
});

describe("layout", () => {
  it("puts overlapping events side by side, and only as many columns as a group needs", () => {
    const list = occurrencesIn(
      [
        event(
          {
            summary: "A",
            ...timed(at(2026, 10, 27, 14), at(2026, 10, 27, 16)),
          },
          "a",
        ),
        event(
          {
            summary: "B",
            ...timed(at(2026, 10, 27, 14, 30), at(2026, 10, 27, 15, 30)),
          },
          "b",
        ),
        event(
          {
            summary: "C",
            ...timed(at(2026, 10, 27, 16), at(2026, 10, 27, 17)),
          },
          "c",
        ),
      ],
      MON,
      NEXT_MON,
    );
    const items = layoutDay(list, at(2026, 10, 27));
    expect(
      items.map((i) => [
        i.occurrence.title,
        i.start,
        i.duration,
        i.col,
        i.cols,
      ]),
    ).toEqual([
      ["A", 14, 2, 0, 2],
      ["B", 14.5, 1, 1, 2],
      ["C", 16, 1, 0, 1],
    ]);
    expect(hourRange(items, false)).toEqual({ from: 8, to: 19 });
    expect(hourRange(items, true)).toEqual({ from: 9, to: 18 });
  });

  it("splits a timed event over midnight, and widens the hours to fit", () => {
    const list = occurrencesIn(
      [event({ ...timed(at(2026, 10, 27, 22), at(2026, 10, 28, 1)) })],
      MON,
      NEXT_MON,
    );
    const tue = layoutDay(list, at(2026, 10, 27));
    const wed = layoutDay(list, at(2026, 10, 28));
    expect([
      tue[0].start,
      tue[0].duration,
      wed[0].start,
      wed[0].duration,
    ]).toEqual([22, 2, 0, 1]);
    expect(hourRange([...tue, ...wed], false)).toEqual({ from: 0, to: 24 });
  });

  it("puts whole-day and day-long events in the all-day row, clipped to the week, in rows that do not overlap", () => {
    const list = occurrencesIn(
      [
        event(
          {
            summary: "Trip",
            allDay: true,
            start: { at: null, date: "2026-10-29", timeZone: null },
            end: { at: null, date: "2026-10-31", timeZone: null },
          },
          "t",
        ),
        event(
          {
            summary: "Long",
            ...timed(at(2026, 10, 25, 12), at(2026, 10, 27, 12)),
          },
          "l",
        ),
        event(
          {
            summary: "Holiday",
            allDay: true,
            start: { at: null, date: "2026-10-30", timeZone: null },
            end: null,
          },
          "h",
        ),
      ],
      MON,
      NEXT_MON,
    );
    const days = Array.from({ length: 7 }, (_, i) => addDays(MON, i));
    expect(
      layoutAllDay(list, days).map((i) => [
        i.occurrence.title,
        i.column,
        i.span,
        i.row,
      ]),
    ).toEqual([
      ["Long", 0, 2, 0],
      ["Trip", 3, 2, 0],
      ["Holiday", 4, 1, 1],
    ]);
    // Weekends hidden: the visible days only
    const weekdays = days.slice(0, 5);
    expect(layoutAllDay(list, weekdays).length).toBe(3);
    expect(layoutDay(list, at(2026, 10, 26))).toEqual([]);
  });
});

describe("times", () => {
  it("reads like the design system", () => {
    expect(formatHour(9, "24")).toBe("9:00");
    expect(formatHour(13.5, "12")).toBe("1:30 PM");
    expect(formatHour(12, "12", true)).toBe("12");
    expect(
      formatRange(at(2026, 10, 26, 10), at(2026, 10, 26, 11, 30), "24"),
    ).toBe("10:00 – 11:30");
    expect(
      formatRange(at(2026, 10, 26, 10), at(2026, 10, 26, 11, 30), "12"),
    ).toBe("10 – 11:30 AM");
    expect(formatRange(at(2026, 10, 26, 11), at(2026, 10, 26, 13), "12")).toBe(
      "11 AM – 1 PM",
    );
  });
});
