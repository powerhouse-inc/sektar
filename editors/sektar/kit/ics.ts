/**
 * A small iCalendar (RFC 5545) reader for previewing `.ics` attachments: the
 * calendar's METHOD and its VEVENTs, with the fields a person reads
 * (summary, when, where, who, how it repeats). Not a full implementation:
 * no recurrence expansion, no VTODO/VJOURNAL, and a time zone the browser
 * does not know by name falls back to the file's own standard offset.
 */

export type IcsTime = {
  /** The instant (all-day dates: local midnight of that day) */
  date: Date;
  allDay: boolean;
};

export type IcsPerson = {
  name: string | null;
  address: string;
  /** PARTSTAT: ACCEPTED, DECLINED, TENTATIVE, NEEDS-ACTION, DELEGATED */
  status: string | null;
  /** ROLE: REQ-PARTICIPANT, OPT-PARTICIPANT, CHAIR, NON-PARTICIPANT */
  role: string | null;
};

export type IcsEvent = {
  uid: string | null;
  summary: string | null;
  description: string | null;
  location: string | null;
  start: IcsTime | null;
  end: IcsTime | null;
  organizer: IcsPerson | null;
  attendees: IcsPerson[];
  /** STATUS: CONFIRMED, TENTATIVE, CANCELLED */
  status: string | null;
  /** A meeting link: the event's URL or a conference property */
  link: string | null;
  /** The RRULE as written, when the event repeats */
  rrule: string | null;
};

export type IcsCalendar = {
  /** METHOD: REQUEST (an invitation), REPLY, CANCEL, PUBLISH, … */
  method: string | null;
  events: IcsEvent[];
};

type Prop = { name: string; params: Record<string, string>; value: string };

/** Lines unfolded (a line starting with a space or tab continues the last). */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .filter((line) => line.length > 0);
}

/** `NAME;P1=a;P2="b:c":value`: a colon inside a quoted parameter is not the separator. */
function parseLine(line: string): Prop | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts: string[] = [];
  let cur = "";
  quoted = false;
  for (const ch of head) {
    if (ch === '"') quoted = !quoted;
    if (ch === ";" && !quoted) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  const params: Record<string, string> = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    params[p.slice(0, eq).toUpperCase()] = p
      .slice(eq + 1)
      .replace(/^"|"$/g, "");
  }
  return { name: parts[0].toUpperCase(), params, value };
}

/** TEXT values: \n, \, \; and \\ escapes. */
export function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_m, c: string) =>
    c === "n" || c === "N" ? "\n" : c,
  );
}

/** Google and Outlook frame their meeting boilerplate with "-::~:~::~…::-" rules. */
function tidyDescription(text: string): string | null {
  const kept = text
    .split("\n")
    .filter((line) => !/^-?::~[:~]*::-?$/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return kept || null;
}

/** The offset (ms) of `timeZone` from UTC at `utcMs`, or null for a zone the browser does not know. */
function zoneOffset(timeZone: string, utcMs: number): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    return asUtc - utcMs;
  } catch {
    return null;
  }
}

/** "+0100" / "-0530" as milliseconds. */
function offsetMs(text: string): number | null {
  const m = /^([+-])(\d{2})(\d{2})/.exec(text.trim());
  if (!m) return null;
  const ms = (Number(m[2]) * 60 + Number(m[3])) * 60_000;
  return m[1] === "-" ? -ms : ms;
}

/** A DATE or DATE-TIME value: UTC (Z), in a named zone (TZID), or floating (local). */
export function parseIcsTime(
  prop: Pick<Prop, "params" | "value">,
  fallbackOffsets: Map<string, number> = new Map(),
): IcsTime | null {
  const v = prop.value.trim();
  const day = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (day || prop.params.VALUE === "DATE") {
    const d = day ?? /^(\d{4})(\d{2})(\d{2})/.exec(v);
    if (!d) return null;
    return {
      date: new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3])),
      allDay: true,
    };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  if (m[7] === "Z") return { date: new Date(wall), allDay: false };
  const tz = prop.params.TZID;
  if (tz) {
    // Two passes find the instant whose wall time in `tz` is the one written.
    const first = zoneOffset(tz, wall);
    if (first !== null) {
      const second = zoneOffset(tz, wall - first) ?? first;
      return { date: new Date(wall - second), allDay: false };
    }
    const fixed = fallbackOffsets.get(tz);
    if (fixed !== undefined)
      return { date: new Date(wall - fixed), allDay: false };
  }
  return {
    date: new Date(y, mo - 1, d, h, mi, s),
    allDay: false,
  };
}

/** P1D, PT1H30M, P1W: a DURATION in milliseconds. */
function durationMs(text: string): number | null {
  const m =
    /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
      text.trim(),
    );
  if (!m) return null;
  const [, sign, w, d, h, mi, s] = m;
  const ms =
    ((Number(w ?? 0) * 7 + Number(d ?? 0)) * 86_400 +
      Number(h ?? 0) * 3_600 +
      Number(mi ?? 0) * 60 +
      Number(s ?? 0)) *
    1000;
  return sign === "-" ? -ms : ms;
}

function person(prop: Prop): IcsPerson {
  const address = prop.value.replace(/^mailto:/i, "").trim();
  const name = prop.params.CN?.trim();
  return {
    name: name && name !== address ? name : null,
    address,
    status: prop.params.PARTSTAT?.toUpperCase() ?? null,
    role: prop.params.ROLE?.toUpperCase() ?? null,
  };
}

export function parseIcs(text: string): IcsCalendar {
  const props = unfold(text)
    .map(parseLine)
    .filter((p): p is Prop => p !== null);

  // Standard offsets of the file's own zones, for a TZID the browser lacks.
  const offsets = new Map<string, number>();
  let zone: string | null = null;
  let inStandard = false;
  for (const p of props) {
    if (p.name === "BEGIN" && p.value === "VTIMEZONE") zone = null;
    else if (p.name === "TZID" && !inStandard) zone = p.value;
    else if (p.name === "BEGIN" && p.value === "STANDARD") inStandard = true;
    else if (p.name === "END" && p.value === "STANDARD") inStandard = false;
    else if (
      p.name === "TZOFFSETTO" &&
      inStandard &&
      zone &&
      !offsets.has(zone)
    ) {
      const ms = offsetMs(p.value);
      if (ms !== null) offsets.set(zone, ms);
    }
  }

  let method: string | null = null;
  const events: IcsEvent[] = [];
  let ev: IcsEvent | null = null;
  let depth = 0; // nested components inside a VEVENT (VALARM) are skipped
  let duration: number | null = null;
  for (const p of props) {
    if (p.name === "BEGIN") {
      if (p.value === "VEVENT" && !ev) {
        ev = {
          uid: null,
          summary: null,
          description: null,
          location: null,
          start: null,
          end: null,
          organizer: null,
          attendees: [],
          status: null,
          link: null,
          rrule: null,
        };
        duration = null;
      } else if (ev) depth++;
      continue;
    }
    if (p.name === "END") {
      if (ev && depth > 0) depth--;
      else if (ev && p.value === "VEVENT") {
        if (!ev.end && ev.start && duration !== null) {
          ev.end = {
            date: new Date(ev.start.date.getTime() + duration),
            allDay: ev.start.allDay,
          };
        }
        events.push(ev);
        ev = null;
      }
      continue;
    }
    if (!ev) {
      if (p.name === "METHOD") method = p.value.trim().toUpperCase();
      continue;
    }
    if (depth > 0) continue;
    switch (p.name) {
      case "UID":
        ev.uid = p.value;
        break;
      case "SUMMARY":
        ev.summary = unescapeText(p.value).trim() || null;
        break;
      case "DESCRIPTION":
        ev.description = tidyDescription(unescapeText(p.value));
        break;
      case "LOCATION":
        ev.location = unescapeText(p.value).trim() || null;
        break;
      case "DTSTART":
        ev.start = parseIcsTime(p, offsets);
        break;
      case "DTEND":
        ev.end = parseIcsTime(p, offsets);
        break;
      case "DURATION":
        duration = durationMs(p.value);
        break;
      case "ORGANIZER":
        ev.organizer = person(p);
        break;
      case "ATTENDEE":
        ev.attendees.push(person(p));
        break;
      case "STATUS":
        ev.status = p.value.trim().toUpperCase();
        break;
      case "URL":
      case "X-GOOGLE-CONFERENCE":
      case "X-MICROSOFT-SKYPETEAMSMEETINGURL":
        ev.link ??= p.value.trim() || null;
        break;
      case "RRULE":
        ev.rrule = p.value.trim();
        break;
    }
  }
  return { method, events };
}

/** "Repeats weekly", "Repeats every 2 weeks, 10 times", "Repeats monthly until 1 Mar 2027". */
export function describeRrule(rrule: string): string {
  const parts = Object.fromEntries(
    rrule.split(";").map((kv) => {
      const [k, v] = kv.split("=");
      return [k.toUpperCase(), v ?? ""];
    }),
  );
  const unit: Record<string, [string, string]> = {
    DAILY: ["daily", "days"],
    WEEKLY: ["weekly", "weeks"],
    MONTHLY: ["monthly", "months"],
    YEARLY: ["yearly", "years"],
  };
  const [one, many] = unit[parts.FREQ] ?? ["", ""];
  if (!one) return "Repeats";
  const interval = Number(parts.INTERVAL ?? 1);
  let text =
    interval > 1 ? `Repeats every ${interval} ${many}` : `Repeats ${one}`;
  if (parts.COUNT) text += `, ${parts.COUNT} times`;
  else if (parts.UNTIL) {
    const until = parseIcsTime({ params: {}, value: parts.UNTIL });
    if (until) {
      text += ` until ${until.date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`;
    }
  }
  return text;
}
