import { describe, expect, it } from "vitest";
import { describeRrule, parseIcs, parseIcsTime, unescapeText } from "./ics.js";

const REPLY = [
  "BEGIN:VCALENDAR",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "METHOD:REPLY",
  "BEGIN:VEVENT",
  "DTSTART:20261027T090000Z",
  "DTEND:20261027T100000Z",
  "ORGANIZER;CN=host@example.com:mailto:host@example.com",
  "UID:abc@google.com",
  "ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=Dennis",
  " ;X-NUM-GUESTS=0:mailto:dennis@example.com",
  "X-GOOGLE-CONFERENCE:https://meet.google.com/abc-defg-hij",
  "DESCRIPTION:-::~:~::~:~:~:~::~:~::-\\nJoin with Google Meet: https://meet.goo",
  " gle.com/abc-defg-hij\\n\\nPlease do not edit this section.\\n-::~:~::~:~::-",
  "LOCATION:",
  "STATUS:CONFIRMED",
  "SUMMARY:Admin discussion\\, part 2",
  "BEGIN:VALARM",
  "DESCRIPTION:Reminder",
  "TRIGGER:-PT10M",
  "END:VALARM",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

const REQUEST_TZ = [
  "BEGIN:VCALENDAR",
  "METHOD:REQUEST",
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Brussels",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "DTSTART:19701025T030000",
  "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VTIMEZONE",
  "TZID:Romance Standard Time",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "DTSTART;TZID=Europe/Brussels:20261121T115000",
  "DTEND;TZID=Europe/Brussels:20261121T134500",
  'ORGANIZER;CN="Doe, Jane":mailto:jane@example.com',
  "ATTENDEE;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=guest@example.com:mailto:guest@example.com",
  "ATTENDEE;PARTSTAT=DECLINED;ROLE=OPT-PARTICIPANT;CN=Sam:mailto:sam@example.com",
  "RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=10",
  "SUMMARY:Flight to Lisbon",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;TZID=Romance Standard Time:20260115T090000",
  "DURATION:PT1H30M",
  "SUMMARY:Windows zone",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20261224",
  "DTEND;VALUE=DATE:20261225",
  "SUMMARY:Holiday",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\n");

describe("parseIcs", () => {
  it("reads a Google reply: method, unfolded attendee, link, tidied description", () => {
    const cal = parseIcs(REPLY);
    expect(cal.method).toBe("REPLY");
    expect(cal.events).toHaveLength(1);
    const ev = cal.events[0];
    expect(ev.summary).toBe("Admin discussion, part 2");
    expect(ev.start?.date.toISOString()).toBe("2026-10-27T09:00:00.000Z");
    expect(ev.end?.date.toISOString()).toBe("2026-10-27T10:00:00.000Z");
    expect(ev.location).toBeNull();
    expect(ev.link).toBe("https://meet.google.com/abc-defg-hij");
    expect(ev.attendees).toEqual([
      {
        name: "Dennis",
        address: "dennis@example.com",
        status: "ACCEPTED",
        role: "REQ-PARTICIPANT",
      },
    ]);
    // the organizer's CN is the address itself: no separate name
    expect(ev.organizer).toEqual({
      name: null,
      address: "host@example.com",
      status: null,
      role: null,
    });
    expect(ev.description).toBe(
      "Join with Google Meet: https://meet.google.com/abc-defg-hij\n\nPlease do not edit this section.",
    );
  });

  it("keeps a VALARM's fields out of the event", () => {
    expect(parseIcs(REPLY).events[0].description).not.toContain("Reminder");
  });

  it("places a named time zone, a Windows zone via its own offset, a duration and an all-day date", () => {
    const cal = parseIcs(REQUEST_TZ);
    expect(cal.method).toBe("REQUEST");
    const [flight, windows, holiday] = cal.events;
    // 11:50 in Brussels in November (UTC+1)
    expect(flight.start?.date.toISOString()).toBe("2026-11-21T10:50:00.000Z");
    expect(flight.end?.date.toISOString()).toBe("2026-11-21T12:45:00.000Z");
    expect(flight.organizer?.name).toBe("Doe, Jane");
    expect(flight.attendees.map((a) => a.status)).toEqual([
      "NEEDS-ACTION",
      "DECLINED",
    ]);
    expect(flight.rrule).toBe("FREQ=WEEKLY;INTERVAL=2;COUNT=10");
    // "Romance Standard Time" is not an IANA name: the file's +0100 applies
    expect(windows.start?.date.toISOString()).toBe("2026-01-15T08:00:00.000Z");
    expect(windows.end?.date.toISOString()).toBe("2026-01-15T09:30:00.000Z");
    expect(holiday.start?.allDay).toBe(true);
    expect(holiday.start?.date.getDate()).toBe(24);
    expect(holiday.end?.date.getDate()).toBe(25);
  });

  it("reads a summer time in a named zone", () => {
    const t = parseIcsTime({
      params: { TZID: "Europe/Brussels" },
      value: "20260701T120000",
    });
    expect(t?.date.toISOString()).toBe("2026-07-01T10:00:00.000Z");
  });

  it("takes a file with no events or broken lines without throwing", () => {
    expect(parseIcs("not a calendar")).toEqual({ method: null, events: [] });
    expect(parseIcs("BEGIN:VCALENDAR\nEND:VCALENDAR").events).toEqual([]);
  });
});

describe("text and recurrence", () => {
  it("unescapes TEXT values", () => {
    expect(unescapeText("a\\, b\\; c\\\\d\\ne")).toBe("a, b; c\\d\ne");
  });

  it("describes a recurrence rule", () => {
    expect(describeRrule("FREQ=WEEKLY")).toBe("Repeats weekly");
    expect(describeRrule("FREQ=WEEKLY;INTERVAL=2;COUNT=10")).toBe(
      "Repeats every 2 weeks, 10 times",
    );
    expect(describeRrule("FREQ=MONTHLY;UNTIL=20270301T000000Z")).toMatch(
      /^Repeats monthly until /,
    );
    expect(describeRrule("FREQ=SECONDLY")).toBe("Repeats");
  });
});
