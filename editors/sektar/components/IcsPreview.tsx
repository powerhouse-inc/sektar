// An .ics attachment in the preview pane: the invitation, reply or event it
// carries, read with kit/ics.ts. Times show in the viewer's own time zone.
import type { EmailAttachment } from "document-models/email";
import { useEffect, useState } from "react";
import type { BadgeTone } from "../kit/format.js";
import {
  describeRrule,
  parseIcs,
  type IcsCalendar,
  type IcsEvent,
  type IcsPerson,
  type IcsTime,
} from "../kit/ics.js";
import { decodeText } from "../kit/text-decode.js";
import { Avatar, Badge, Icon } from "../kit/ui.js";

/** A calendar file: `text/calendar`, or an `.ics` name when no type is known.
 * The served type wins over the declared one. */
export function isCalendarFile(
  file: Pick<EmailAttachment, "fileName" | "mimeType">,
  actualMime?: string,
): boolean {
  const mime = (actualMime ?? file.mimeType ?? "")
    .toLowerCase()
    .split(";")[0]
    .trim();
  if (mime === "text/calendar" || mime === "application/ics") return true;
  const generic = !mime || mime === "application/octet-stream";
  return generic && /\.(ics|ical|ifb)$/i.test(file.fileName);
}

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ACCEPTED: { label: "Accepted", tone: "success" },
  DECLINED: { label: "Declined", tone: "danger" },
  TENTATIVE: { label: "Maybe", tone: "warning" },
  "NEEDS-ACTION": { label: "Awaiting reply", tone: "outline" },
  DELEGATED: { label: "Delegated", tone: "neutral" },
};

const REPLY_VERB: Record<string, string> = {
  ACCEPTED: "accepted",
  DECLINED: "declined",
  TENTATIVE: "tentatively accepted",
  DELEGATED: "delegated",
};

const day = (d: Date) =>
  d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const time = (d: Date) =>
  d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "Tue 27 Oct 2026 · 10:00 – 11:00", "Thu 24 Dec 2026 (all day)", or a span. */
export function describeWhen(
  start: IcsTime | null,
  end: IcsTime | null,
): string {
  if (!start) return "No date given";
  if (start.allDay) {
    // An all-day DTEND is the day after the last one.
    const last = end ? new Date(end.date.getTime() - 86_400_000) : start.date;
    return sameDay(start.date, last) || last < start.date
      ? `${day(start.date)} (all day)`
      : `${day(start.date)} – ${day(last)}`;
  }
  if (!end) return `${day(start.date)} · ${time(start.date)}`;
  return sameDay(start.date, end.date)
    ? `${day(start.date)} · ${time(start.date)} – ${time(end.date)}`
    : `${day(start.date)}, ${time(start.date)} – ${day(end.date)}, ${time(end.date)}`;
}

function personLabel(p: IcsPerson): string {
  return p.name ?? p.address;
}

/** What the file is: an invitation, someone's answer, a cancellation. */
function headline(
  cal: IcsCalendar,
  ev: IcsEvent,
): { text: string; tone: BadgeTone } | null {
  if (cal.method === "CANCEL" || ev.status === "CANCELLED") {
    return { text: "Cancelled", tone: "danger" };
  }
  if (cal.method === "REPLY") {
    const who = ev.attendees.find((a) => a.status && REPLY_VERB[a.status]);
    if (who?.status) {
      return {
        text: `${personLabel(who)} ${REPLY_VERB[who.status]}`,
        tone: STATUS[who.status]?.tone ?? "neutral",
      };
    }
    return { text: "Reply", tone: "neutral" };
  }
  if (cal.method === "REQUEST") return { text: "Invitation", tone: "info" };
  if (cal.method === "COUNTER")
    return { text: "New time proposed", tone: "warning" };
  return null;
}

function EventView({ cal, ev }: { cal: IcsCalendar; ev: IcsEvent }) {
  const head = headline(cal, ev);
  // The organizer is often an attendee too: one row, with their answer.
  const same = (a: IcsPerson, b: IcsPerson) =>
    a.address.toLowerCase() === b.address.toLowerCase();
  const organizer = ev.organizer;
  const organizerAsAttendee = organizer
    ? ev.attendees.find((a) => same(a, organizer))
    : undefined;
  const attendees = organizer
    ? ev.attendees.filter((a) => !same(a, organizer))
    : ev.attendees;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <article className="sk-ics">
      {head && (
        <div>
          <Badge tone={head.tone} pill>
            {head.text}
          </Badge>
        </div>
      )}
      <h3 className="sk-ics__title">{ev.summary ?? "(no title)"}</h3>
      <ul className="sk-ics__facts">
        <li>
          <Icon name="calendar" size={16} mono />
          <span>
            {describeWhen(ev.start, ev.end)}
            {ev.start && !ev.start.allDay && (
              <span className="sk-ics__zone"> · {zone}</span>
            )}
            {ev.rrule && (
              <span className="sk-ics__zone"> · {describeRrule(ev.rrule)}</span>
            )}
          </span>
        </li>
        {ev.location && (
          <li>
            <Icon name="arrow-right" size={16} mono />
            <span>{ev.location}</span>
          </li>
        )}
        {ev.link && (
          <li>
            <Icon name="arrow-up-right" size={16} mono />
            <a href={ev.link} target="_blank" rel="noreferrer">
              {ev.link.replace(/^https?:\/\//, "")}
            </a>
          </li>
        )}
      </ul>
      {(organizer || attendees.length > 0) && (
        <section className="sk-stack sk-stack--2">
          <h4 className="sk-eyebrow">
            People · {attendees.length + (organizer ? 1 : 0)}
          </h4>
          <ul className="sk-list sk-list--divided">
            {organizer && (
              <PersonRow
                p={{
                  ...organizer,
                  name: organizer.name ?? organizerAsAttendee?.name ?? null,
                }}
                badge={{ label: "Organizer", tone: "forest" }}
                second={
                  organizerAsAttendee?.status
                    ? STATUS[organizerAsAttendee.status]
                    : undefined
                }
              />
            )}
            {attendees.map((a, i) => (
              <PersonRow
                key={`${a.address}-${i}`}
                p={a}
                badge={a.status ? STATUS[a.status] : undefined}
                optional={a.role === "OPT-PARTICIPANT"}
              />
            ))}
          </ul>
        </section>
      )}
      {ev.description && (
        <p className="sk-ics__description">{ev.description}</p>
      )}
    </article>
  );
}

function PersonRow({
  p,
  badge,
  second,
  optional,
}: {
  p: IcsPerson;
  badge?: { label: string; tone: BadgeTone };
  /** A second badge: the organizer's own answer */
  second?: { label: string; tone: BadgeTone };
  optional?: boolean;
}) {
  return (
    <li className="sk-list-item">
      <Avatar name={personLabel(p)} size="sm" />
      <span className="sk-list-item__body">
        <span className="sk-list-item__title">{personLabel(p)}</span>
        <span className="sk-list-item__meta">
          {p.name ? p.address : null}
          {optional && (p.name ? " · optional" : "optional")}
        </span>
      </span>
      {(badge || second) && (
        <span className="sk-list-item__value sk-ics__badges">
          {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
          {second && <Badge tone={second.tone}>{second.label}</Badge>}
        </span>
      )}
    </li>
  );
}

/** The calendar file at `url`, read and shown event by event. */
export function IcsPreview({ url }: { url: string }) {
  const [cal, setCal] = useState<IcsCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setCal(null);
    setError(null);
    fetch(url)
      .then(async (r) =>
        decodeText(await r.arrayBuffer(), r.headers.get("content-type")),
      )
      .then((text) => {
        if (live) setCal(parseIcs(text));
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      live = false;
    };
  }, [url]);
  if (error) {
    return (
      <p className="sk-small sk-text-danger">
        Could not read this calendar file: {error}
      </p>
    );
  }
  if (!cal) return <p className="sk-small sk-text-muted">Reading…</p>;
  if (cal.events.length === 0) {
    return (
      <p className="sk-small sk-text-muted">
        This calendar file has no events to show. Open it in a new tab or
        download it.
      </p>
    );
  }
  return (
    <div className="sk-stack sk-stack--5">
      {cal.events.map((ev, i) => (
        <EventView key={ev.uid ?? i} cal={cal} ev={ev} />
      ))}
    </div>
  );
}
