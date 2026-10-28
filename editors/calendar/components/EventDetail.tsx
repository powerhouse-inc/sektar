import type { ReactNode } from "react";
import { Icon, type IconName } from "../../sektar/kit/ui.js";
import {
  describeRepeat,
  formatDays,
  formatRange,
  type HourFormat,
  type Occurrence,
} from "../week.js";

/**
 * The sidebar with an event selected (design system: Patterns · Calendar):
 * its calendar, title and time, the video call, where, who, how it repeats,
 * and the notes. Read-only: the event changes at the provider.
 */
export function EventDetail({
  occurrence: o,
  slot,
  calendar,
  hours,
}: {
  occurrence: Occurrence;
  slot: string;
  calendar: string;
  hours: HourFormat;
}) {
  const s = o.state;
  const guests = guestLine(o);
  const repeat = o.repeats ? (describeRepeat(s) ?? "Repeats") : null;
  const notes = s.description ? plainText(s.description) : null;
  return (
    <>
      <div>
        <p className={`sk-cal-event__cal ${slot}`}>
          <i className="sk-cal-swatch" />
          <span>{calendar}</span>
        </p>
        <h3 className="sk-cal-event__title">{o.title}</h3>
        <p className="sk-cal-event__when">
          <span>{formatDays(o)}</span>
          {o.allDay ? (
            <span> · all day</span>
          ) : (
            <span> · {formatRange(o.start, o.end, hours)}</span>
          )}
        </p>
      </div>
      {s.meetingUrl && (
        <div>
          <a
            className="sk-btn sk-btn--soft"
            href={s.meetingUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="arrow-up-right" /> Join video call
          </a>
        </div>
      )}
      {(s.location || guests || repeat) && (
        <div className="sk-cal-event__rows">
          {s.location && <Row icon="pin">{s.location}</Row>}
          {guests && <Row icon="customers">{guests}</Row>}
          {repeat && <Row icon="sync">{repeat}</Row>}
        </div>
      )}
      {notes && (
        <div>
          <p className="sk-cal-side__label">Notes</p>
          <p
            className="sk-small sk-text-secondary"
            style={{
              margin: 0,
              whiteSpace: "pre-line",
              overflowWrap: "anywhere",
            }}
          >
            {notes}
          </p>
        </div>
      )}
    </>
  );
}

function Row({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="sk-cal-event__row">
      <Icon name={icon} />
      <span>{children}</span>
    </div>
  );
}

/** Who else is there: up to three names, then how many more, and how many said yes */
function guestLine(o: Occurrence): string | null {
  const others = o.state.attendees.filter((a) => !a.self);
  if (others.length === 0) return null;
  const names = others.slice(0, 3).map((a) => a.name || a.email);
  const more = others.length > 3 ? ` and ${others.length - 3} more` : "";
  const going = o.state.attendees.filter(
    (a) => a.response === "ACCEPTED",
  ).length;
  return `${names.join(", ")}${more} · ${going} going`;
}

/** Providers send descriptions as light HTML: keep the line breaks, drop the tags */
export function plainText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n");
  const doc = new DOMParser().parseFromString(withBreaks, "text/html");
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
