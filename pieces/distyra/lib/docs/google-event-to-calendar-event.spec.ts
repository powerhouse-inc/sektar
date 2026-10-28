import {
  reducer,
  utils,
  type CalendarEventAction as ModelAction,
} from "document-models/calendar-event/v1";
import { describe, expect, it } from "vitest";
import {
  eventName,
  eventsFrom,
  mapGoogleEvents,
  selfAddress,
} from "./google-event-to-calendar-event.js";

const AT = "2026-10-28T12:00:00.000Z";
const options = {
  calendarId: "primary",
  calendarName: "Wouter",
  capturedAt: AT,
};

// Shaped like the Google Calendar API's event resource, as the trigger emits it.
const meeting = {
  kind: "calendar#event",
  id: "abc123",
  status: "confirmed",
  htmlLink: "https://www.google.com/calendar/event?eid=abc",
  updated: "2026-10-27T09:15:00.123Z",
  summary: "Pilot review\nwith the team",
  description: "Agenda: integrations",
  location: "Ghent",
  creator: { email: "wouter@powerhouse.inc", self: true },
  organizer: {
    email: "wouter@powerhouse.inc",
    displayName: "Wouter",
    self: true,
  },
  start: { dateTime: "2026-10-29T10:00:00+01:00", timeZone: "Europe/Brussels" },
  end: { dateTime: "2026-10-29T11:00:00+01:00", timeZone: "Europe/Brussels" },
  iCalUID: "abc123@google.com",
  attendees: [
    {
      email: "Wouter@powerhouse.inc",
      organizer: true,
      self: true,
      responseStatus: "accepted",
    },
    {
      email: "dennis@example.com",
      displayName: "Dennis",
      responseStatus: "tentative",
      optional: true,
    },
    { email: "dennis@example.com", responseStatus: "accepted" },
    { displayName: "No address" },
  ],
  hangoutLink: "https://meet.google.com/abc-defg-hij",
};

const holiday = {
  id: "hol1",
  status: "confirmed",
  summary: "Holiday",
  start: { date: "2026-12-24" },
  end: { date: "2026-12-27" },
  transparency: "transparent",
  iCalUID: "hol1@google.com",
  organizer: { email: "someone@example.com" },
  attendees: [
    {
      email: "wouter@powerhouse.inc",
      self: true,
      responseStatus: "needsAction",
    },
  ],
};

const series = {
  id: "weekly",
  status: "confirmed",
  summary: "Weekly sync",
  start: { dateTime: "2026-10-05T09:00:00Z" },
  end: { dateTime: "2026-10-05T09:30:00Z" },
  recurrence: [
    "RRULE:FREQ=WEEKLY;BYDAY=MO",
    "EXDATE;TZID=Europe/Brussels:20261019T110000",
  ],
  iCalUID: "weekly@google.com",
  conferenceData: {
    entryPoints: [
      { entryPointType: "phone", uri: "tel:+32" },
      { entryPointType: "video", uri: "https://zoom.us/j/1" },
    ],
  },
};

// A cancelled occurrence of the series: Google sends little more than this.
const cancelledOccurrence = {
  id: "weekly_20261012T090000Z",
  status: "cancelled",
  recurringEventId: "weekly",
  originalStartTime: { dateTime: "2026-10-12T09:00:00Z" },
  iCalUID: "weekly@google.com",
};

describe("Google events to calendar events", () => {
  it("maps a meeting: key, times in UTC with their zone, people, link", () => {
    const { items, skipped, count } = mapGoogleEvents(meeting, options);
    expect(count).toBe(1);
    expect(skipped).toEqual([]);
    const item = items[0];
    expect(item.key).toBe("cal:wouter@powerhouse.inc:abc123@google.com");
    expect(item.name).toBe("Pilot review with the team");
    expect(item.folder).toBe("Wouter");
    const input = item.actions[0].input as Record<string, unknown>;
    expect(input).toMatchObject({
      externalId: item.key,
      source: "google",
      sourceId: "abc123",
      start: { at: "2026-10-29T09:00:00.000Z", timeZone: "Europe/Brussels" },
      allDay: false,
      status: "CONFIRMED",
      busy: true,
      meetingUrl: "https://meet.google.com/abc-defg-hij",
      organizer: { email: "wouter@powerhouse.inc", name: "Wouter" },
      sourceUpdatedAt: "2026-10-27T09:15:00.123Z",
      calendar: {
        id: "primary",
        name: "Wouter",
        account: "wouter@powerhouse.inc",
      },
    });
    expect((input.attendees as unknown[]).length).toBe(3);
  });

  it("maps a whole-day, free event; the account comes from the attendee marked self", () => {
    const item = mapGoogleEvents([holiday], { ...options, calendarName: null })
      .items[0];
    expect(item.key).toBe("cal:wouter@powerhouse.inc:hol1@google.com");
    expect(item.folder).toBe("wouter@powerhouse.inc");
    expect(item.actions[0].input).toMatchObject({
      start: { date: "2026-12-24" },
      end: { date: "2026-12-27" },
      allDay: true,
      busy: false,
    });
  });

  it("keys a changed occurrence apart from its series, and keeps a cancelled one", () => {
    const { items } = mapGoogleEvents([series, cancelledOccurrence], {
      ...options,
      account: "Wouter@Powerhouse.inc",
    });
    expect(items.map((i) => i.key)).toEqual([
      "cal:wouter@powerhouse.inc:weekly@google.com",
      "cal:wouter@powerhouse.inc:weekly@google.com:2026-10-12T09:00:00.000Z",
    ]);
    expect(items[0].actions[0].input).toMatchObject({
      recurrence: [
        "RRULE:FREQ=WEEKLY;BYDAY=MO",
        "EXDATE;TZID=Europe/Brussels:20261019T110000",
      ],
      meetingUrl: "https://zoom.us/j/1",
    });
    expect(items[1]).toMatchObject({ status: "CANCELLED", name: "(no title)" });
    expect(items[1].actions[0].input).toMatchObject({
      recurrenceId: "2026-10-12T09:00:00.000Z",
    });
  });

  it("falls back to the calendar id when nothing says whose calendar it is", () => {
    const item = mapGoogleEvents(
      { id: "x", iCalUID: "x@google.com", start: { dateTime: "bad" } },
      options,
    ).items[0];
    expect(item.key).toBe("cal:primary:x@google.com");
    expect(item.start).toBeNull();
  });

  it("takes a Get Events answer, bare or as the step's whole output", () => {
    const answer = { kind: "calendar#events", items: [meeting, holiday] };
    expect(mapGoogleEvents(answer, options).count).toBe(2);
    expect(
      mapGoogleEvents({ status: 200, body: answer }, options).items.map(
        (i) => i.key,
      ),
    ).toEqual([
      "cal:wouter@powerhouse.inc:abc123@google.com",
      "cal:wouter@powerhouse.inc:hol1@google.com",
    ]);
    expect(eventsFrom({ kind: "calendar#events", items: [] })).toEqual([]);
  });

  it("refuses a window with more than one page, rather than leave a hole", () => {
    expect(() =>
      mapGoogleEvents(
        { body: { items: [meeting], nextPageToken: "p2" } },
        options,
      ),
    ).toThrow(
      /more than one page of events for this window \(1 on the first\)/,
    );
  });

  it("skips what is not an event", () => {
    expect(mapGoogleEvents([null, {}, "x"], options).skipped).toEqual([
      { index: 0, reason: "no Google event id" },
      { index: 1, reason: "no Google event id" },
      { index: 2, reason: "no Google event id" },
    ]);
    expect(mapGoogleEvents(undefined, options).count).toBe(0);
  });

  it("names events on one line, never empty", () => {
    expect(eventName("  a\tb  ")).toBe("a b");
    expect(eventName(null)).toBe("(no title)");
    expect(eventName("x".repeat(200))).toHaveLength(120);
    expect(selfAddress({ creator: { email: "Me@X.be", self: true } })).toBe(
      "me@x.be",
    );
    expect(selfAddress({})).toBeNull();
  });

  it("writes documents the calendar event model accepts, and updates them on re-import", () => {
    for (const event of [meeting, holiday, series, cancelledOccurrence]) {
      const [item] = mapGoogleEvents(event, options).items;
      let doc = utils.createDocument();
      for (const action of item.actions) {
        doc = reducer(doc, {
          ...action,
          id: crypto.randomUUID(),
          timestampUtcMs: AT,
          scope: "global",
        } as unknown as ModelAction);
        expect(doc.operations.global.at(-1)?.error).toBeFalsy();
      }
      expect(doc.state.global.externalId).toBe(item.key);
      // The same event again: one document, updated
      doc = reducer(doc, {
        ...item.updateActions[0],
        id: crypto.randomUUID(),
        timestampUtcMs: AT,
        scope: "global",
      } as unknown as ModelAction);
      expect(doc.operations.global.at(-1)?.error).toBeFalsy();
    }
    const [meetingItem] = mapGoogleEvents(meeting, options).items;
    let doc = utils.createDocument();
    doc = reducer(doc, {
      ...meetingItem.actions[0],
      id: "1",
      timestampUtcMs: AT,
      scope: "global",
    } as unknown as ModelAction);
    expect(doc.state.global.attendees.map((a) => [a.id, a.response])).toEqual([
      ["wouter@powerhouse.inc", "ACCEPTED"],
      ["dennis@example.com", "TENTATIVE"],
    ]);
  });
});
