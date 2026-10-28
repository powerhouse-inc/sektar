import {
  captureEvent,
  isCalendarEventDocument,
  reducer,
  utils,
} from "document-models/calendar-event/v1";
import { describe, expect, it } from "vitest";

const AT = "2026-10-28T12:00:00.000Z";

const base = {
  externalId: "cal:me@x.be:uid-1@google.com",
  source: "google",
  allDay: false,
  status: "CONFIRMED" as const,
  capturedAt: AT,
};

describe("calendar event", () => {
  it("starts empty", () => {
    const doc = utils.createDocument();
    expect(isCalendarEventDocument(doc)).toBe(true);
    expect(doc.state.global).toMatchObject({
      externalId: null,
      status: "CONFIRMED",
      busy: true,
      attendees: [],
      recurrence: [],
    });
  });

  it("takes everything the provider says, and fills what it leaves out", () => {
    const doc = reducer(
      utils.createDocument(),
      captureEvent({
        ...base,
        uid: "uid-1@google.com",
        recurrenceId: "2026-10-12T09:00:00.000Z",
        calendar: { id: "primary", name: "Me", account: "me@x.be" },
        sourceId: "e1",
        sourceUrl: "https://calendar.google.com/e1",
        summary: "Sync",
        description: "d",
        location: "Ghent",
        meetingUrl: "https://meet.google.com/x",
        start: { at: "2026-10-29T09:00:00.000Z", timeZone: "Europe/Brussels" },
        end: { date: "2026-10-30" },
        busy: false,
        organizer: { email: "me@x.be", name: "Me" },
        attendees: [
          {
            email: " Me@x.be ",
            response: "ACCEPTED",
            organizer: true,
            self: true,
          },
          { email: "me@x.be", response: "DECLINED" },
          { email: "  ", response: "ACCEPTED" },
          { email: "a@b.c", name: "A", response: "TENTATIVE", optional: true },
        ],
        recurrence: ["RRULE:FREQ=WEEKLY"],
        sourceUpdatedAt: AT,
      }),
    );
    const s = doc.state.global;
    expect(s).toMatchObject({
      uid: "uid-1@google.com",
      recurrenceId: "2026-10-12T09:00:00.000Z",
      calendar: { id: "primary", name: "Me", account: "me@x.be" },
      start: {
        at: "2026-10-29T09:00:00.000Z",
        date: null,
        timeZone: "Europe/Brussels",
      },
      end: { at: null, date: "2026-10-30", timeZone: null },
      busy: false,
      organizer: { email: "me@x.be", name: "Me" },
      recurrence: ["RRULE:FREQ=WEEKLY"],
    });
    expect(s.attendees).toEqual([
      {
        id: "me@x.be",
        email: "Me@x.be",
        name: null,
        response: "ACCEPTED",
        optional: false,
        organizer: true,
        self: true,
      },
      {
        id: "a@b.c",
        email: "a@b.c",
        name: "A",
        response: "TENTATIVE",
        optional: true,
        organizer: false,
        self: false,
      },
    ]);

    // A bare capture: what the provider left out reads as empty
    const bare = reducer(
      utils.createDocument(),
      captureEvent({ ...base, calendar: { id: "primary" }, organizer: {} }),
    ).state.global;
    expect(bare).toMatchObject({
      uid: null,
      recurrenceId: null,
      calendar: { id: "primary", name: null, account: null },
      start: null,
      end: null,
      busy: true,
      organizer: { email: null, name: null },
      attendees: [],
      recurrence: [],
      sourceUpdatedAt: null,
    });
  });

  it("updates on a re-import of the same event, and refuses another event", () => {
    let doc = reducer(
      utils.createDocument(),
      captureEvent({ ...base, summary: "Old" }),
    );
    doc = reducer(
      doc,
      captureEvent({ ...base, summary: "New", status: "CANCELLED" }),
    );
    expect(doc.state.global).toMatchObject({
      summary: "New",
      status: "CANCELLED",
    });
    const before = JSON.stringify(doc.state.global);
    doc = reducer(
      doc,
      captureEvent({ ...base, externalId: "cal:me@x.be:other" }),
    );
    expect(doc.operations.global.at(-1)?.error).toMatch(
      /not cal:me@x.be:other/,
    );
    expect(JSON.stringify(doc.state.global)).toBe(before);
  });
});
