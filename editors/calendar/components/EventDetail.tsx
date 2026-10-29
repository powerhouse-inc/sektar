import {
  useCalendarEventDocumentById,
  type CalendarEventState,
} from "document-models/calendar-event";
import { Component, Suspense, type ReactNode } from "react";
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
 *
 * The week's index row says all but who comes and the notes: those come
 * from the event's own document, loaded for the one event opened. Until it
 * is there (or should it fail to load) the rest shows without them.
 */
export function EventDetail(props: DetailProps) {
  return (
    <Fallback
      key={props.occurrence.documentId}
      fallback={<EventSummary {...props} />}
    >
      <Suspense fallback={<EventSummary {...props} />}>
        <EventWithDocument {...props} />
      </Suspense>
    </Fallback>
  );
}

type DetailProps = {
  occurrence: Occurrence;
  slot: string;
  calendar: string;
  hours: HourFormat;
};

function EventWithDocument(props: DetailProps) {
  const [document] = useCalendarEventDocumentById(props.occurrence.documentId);
  return <EventSummary {...props} full={document?.state.global} />;
}

/** A document that cannot be loaded leaves the summary without guests and notes. */
class Fallback extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function EventSummary({
  occurrence: o,
  slot,
  calendar,
  hours,
  full,
}: DetailProps & { full?: CalendarEventState }) {
  const s = o.state;
  const guests = full ? guestLine(full) : null;
  const repeat = o.repeats ? (describeRepeat(s) ?? "Repeats") : null;
  const notes = full?.description ? plainText(full.description) : null;
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
function guestLine(state: CalendarEventState): string | null {
  const others = state.attendees.filter((a) => !a.self);
  if (others.length === 0) return null;
  const names = others.slice(0, 3).map((a) => a.name || a.email);
  const more = others.length > 3 ? ` and ${others.length - 3} more` : "";
  const going = state.attendees.filter(
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
