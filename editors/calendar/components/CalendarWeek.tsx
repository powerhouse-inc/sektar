import { useCalendarEventDocumentsInSelectedDrive } from "document-models/calendar-event";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useFillHeight } from "../../backfills/components/measure.js";
import { cx, Icon } from "../../sektar/kit/ui.js";
import { Pane } from "../../sektar/kit/workspace.js";
import {
  addDays,
  calendarKey,
  calendarLabel,
  colourSlot,
  formatHour,
  formatRange,
  hourRange,
  hoursOf,
  isWeekend,
  layoutAllDay,
  layoutDay,
  occurrencesIn,
  sameDay,
  startOfDay,
  weekStartOf,
  weekTitle,
  WORK_FROM,
  WORK_TO,
  type Occurrence,
} from "../week.js";
import { EventDetail } from "./EventDetail.js";
import { ViewOptions } from "./ViewOptions.js";
import { useCalendarPrefs } from "./prefs.js";

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "short" });

/**
 * The week (design system: Patterns · Calendar, desktop): the toolbar, the
 * time grid with its all-day row, and the sidebar that holds the view
 * options until an event is picked, then shows that event. Esc, the close
 * button or a click on an empty part of the grid goes back to the options.
 */
export function CalendarWeek() {
  const docs = useCalendarEventDocumentsInSelectedDrive();
  const [prefs, setPrefs] = useCalendarPrefs();
  const now = useNow();
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const height = useFillHeight(root, docs !== undefined);

  const weekStart = weekStartOf(anchor, prefs.weekStart);
  const allDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const days = prefs.weekends ? allDays : allDays.filter((d) => !isWeekend(d));

  // Every calendar in the drive, in a stable order: that order picks the colour
  const calendars = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of docs ?? []) {
      const key = calendarKey(d.state.global);
      if (!seen.has(key)) seen.set(key, calendarLabel(d.state.global));
    }
    return [...seen.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0]))
      .map(([key, label], i) => ({ key, label, slot: colourSlot(i) }));
  }, [docs]);
  const slotOf = (key: string) =>
    calendars.find((c) => c.key === key)?.slot ?? "sk-cal-c1";

  const week = useMemo(
    () =>
      occurrencesIn(
        (docs ?? []).map((d) => ({
          documentId: d.header.id,
          state: d.state.global,
        })),
        weekStart,
        addDays(weekStart, 7),
      ),
    // weekStart is a new Date each render: key on its time
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [docs, weekStart.getTime()],
  );
  const shown = week.filter((o) => !prefs.hidden.includes(o.calendar));
  const counts = new Map<string, number>();
  for (const o of week)
    counts.set(o.calendar, (counts.get(o.calendar) ?? 0) + 1);

  const allDay = layoutAllDay(shown, days);
  const columns = days.map((day) => ({ day, items: layoutDay(shown, day) }));
  const { from, to } = hourRange(
    columns.flatMap((c) => c.items),
    prefs.workHours,
  );
  const selectedOccurrence = shown.find((o) => o.key === selected) ?? null;

  // A narrow calendar floats its sidebar over the grid: it starts closed,
  // opens with an event and closes with it (Sektar.calendar's floating()).
  const floating = () => {
    const side = root.current?.querySelector(".sk-cal-side");
    return !!side && getComputedStyle(side).position === "absolute";
  };
  useLayoutEffect(() => {
    if (floating()) setCollapsed(true);
  }, []);
  const select = (key: string | null) => {
    setSelected(key);
    if (key) setCollapsed(false);
    else if (floating()) setCollapsed(true);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // The grid opens scrolled to the first event of the week, or the morning
  const scroller = useRef<HTMLDivElement>(null);
  const hourPx = 48;
  const firstHour = Math.min(
    8,
    ...columns.flatMap((c) => c.items.map((i) => Math.floor(i.start))),
  );
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = Math.max(0, (firstHour - from) * hourPx);
    // once per week shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart.getTime(), from]);

  const title = weekTitle(days.length > 0 ? days : allDays);
  const go = (weeks: number) => {
    setAnchor((a) => addDays(a, weeks * 7));
    select(null);
  };
  const nowHours = hoursOf(now);

  return (
    <div
      ref={root}
      className="sk-calendar"
      style={{ height: height ? `${height}px` : undefined }}
    >
      <div className="sk-cal-toolbar">
        <button
          className="sk-btn sk-btn--secondary sk-btn--sm"
          type="button"
          onClick={() => {
            setAnchor(startOfDay(new Date()));
            select(null);
          }}
        >
          Today
        </button>
        <span className="sk-cal-toolbar__nav">
          <button
            className="sk-btn sk-btn--ghost sk-btn--sm sk-btn--icon"
            type="button"
            aria-label="Previous week"
            onClick={() => go(-1)}
          >
            <span
              style={{ display: "inline-flex", transform: "rotate(180deg)" }}
            >
              <Icon name="chevron-right" />
            </span>
          </button>
          <button
            className="sk-btn sk-btn--ghost sk-btn--sm sk-btn--icon"
            type="button"
            aria-label="Next week"
            onClick={() => go(1)}
          >
            <Icon name="chevron-right" />
          </button>
        </span>
        <h2 className="sk-cal-toolbar__title">
          <span className="sk-cal-toolbar__long">
            {title.long}{" "}
            <span className="sk-cal-toolbar__year">{title.year}</span>
          </span>
          <span className="sk-cal-toolbar__short">{title.short}</span>
        </h2>
        <span className="sk-cal-toolbar__spacer" />
        <div className="sk-segmented" role="group" aria-label="View">
          {["Day", "Week", "Month", "Agenda"].map((v) => (
            <button
              key={v}
              className="sk-segmented__item"
              type="button"
              aria-pressed={v === "Week"}
              disabled={v !== "Week"}
              title={v === "Week" ? undefined : "Not available yet"}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cx(
          "sk-workspace sk-workspace--panes sk-cal-app",
          prefs.fadePast && "is-fade-past",
          selectedOccurrence && "has-event",
        )}
      >
        <section className="sk-pane sk-cal-main">
          <div
            className="sk-cal"
            style={
              {
                "--sk-cal-from": from,
                "--sk-cal-to": to,
                "--sk-cal-days": days.length,
                "--sk-cal-hour": `${hourPx}px`,
              } as CSSProperties
            }
          >
            <div className="sk-cal__scroll" ref={scroller}>
              <div className="sk-cal__top">
                <div className="sk-cal__head">
                  <span />
                  {days.map((d) => (
                    <div
                      key={d.getTime()}
                      className={cx(
                        "sk-cal__day",
                        sameDay(d, now) && "is-today",
                        isWeekend(d) && "sk-cal__day--off",
                      )}
                    >
                      <span className="sk-cal__weekday">
                        {WEEKDAY.format(d)}
                      </span>
                      <span className="sk-cal__date">{d.getDate()}</span>
                    </div>
                  ))}
                </div>
                <div className="sk-cal__allday">
                  <span className="sk-cal__allday-label">All day</span>
                  {allDay.map(({ occurrence: o, column, span, row }) => (
                    <EventButton
                      key={o.key}
                      occurrence={o}
                      slot={slotOf(o.calendar)}
                      selected={o.key === selected}
                      past={o.end <= now}
                      onSelect={select}
                      style={{
                        gridColumn: `${column + 2} / span ${span}`,
                        gridRow: row + 1,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="sk-cal__grid">
                <div className="sk-cal__hours">
                  {Array.from({ length: to - from }, (_, i) => from + i).map(
                    (h) => (
                      <span
                        key={h}
                        className={cx(
                          "sk-cal__hour",
                          (h < WORK_FROM || h >= WORK_TO) && "is-outside",
                        )}
                        style={{ "--h": h } as CSSProperties}
                      >
                        {prefs.hours === "24" ? `${h}:00` : formatHour(h, "12")}
                      </span>
                    ),
                  )}
                </div>
                {columns.map(({ day, items }) => (
                  <div
                    key={day.getTime()}
                    className={cx(
                      "sk-cal__col",
                      isWeekend(day) && "sk-cal__col--off",
                    )}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) select(null);
                    }}
                  >
                    {items.map((item) => {
                      const o = item.occurrence;
                      const short = item.duration <= 0.5;
                      return (
                        <EventButton
                          key={o.key}
                          occurrence={o}
                          slot={slotOf(o.calendar)}
                          selected={o.key === selected}
                          past={o.end <= now}
                          short={short}
                          meta={
                            short
                              ? formatHour(hoursOf(o.start), prefs.hours)
                              : [
                                  formatRange(o.start, o.end, prefs.hours),
                                  o.state.location ||
                                    (o.state.meetingUrl ? "Video call" : null),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")
                          }
                          onSelect={select}
                          style={
                            {
                              "--s": item.start,
                              "--d": item.duration,
                              "--col": item.col,
                              "--cols": item.cols,
                            } as CSSProperties
                          }
                        />
                      );
                    })}
                    {sameDay(day, now) &&
                      nowHours >= from &&
                      nowHours <= to && (
                        <span
                          className="sk-cal__now"
                          style={{ "--now": nowHours } as CSSProperties}
                        />
                      )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Pane
          side="end"
          className="sk-cal-side"
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          title={selectedOccurrence ? "Event" : "View"}
          trailing={
            selectedOccurrence ? (
              <button
                className="sk-btn sk-btn--ghost sk-btn--sm sk-btn--icon"
                type="button"
                aria-label="Close event, back to the view"
                onClick={() => select(null)}
              >
                <Icon name="close" />
              </button>
            ) : undefined
          }
        >
          {selectedOccurrence ? (
            <EventDetail
              occurrence={selectedOccurrence}
              slot={slotOf(selectedOccurrence.calendar)}
              calendar={calendarLabel(selectedOccurrence.state)}
              hours={prefs.hours}
            />
          ) : (
            <ViewOptions
              prefs={prefs}
              setPrefs={setPrefs}
              days={allDays}
              today={now}
              onPick={(d) => {
                setAnchor(startOfDay(d));
                select(null);
              }}
              calendars={calendars.map((c) => ({
                ...c,
                count: counts.get(c.key) ?? 0,
              }))}
            />
          )}
        </Pane>
      </div>
    </div>
  );
}

function EventButton({
  occurrence: o,
  slot,
  selected,
  past,
  short,
  meta,
  style,
  onSelect,
}: {
  occurrence: Occurrence;
  slot: string;
  selected: boolean;
  past: boolean;
  short?: boolean;
  meta?: string;
  style: CSSProperties;
  onSelect: (key: string | null) => void;
}) {
  return (
    <button
      className={cx(
        "sk-event",
        slot,
        short && "sk-event--short",
        o.tentative && "sk-event--tentative",
        past && "is-past",
        selected && "is-selected",
      )}
      type="button"
      style={style}
      aria-pressed={selected}
      onClick={() => onSelect(selected ? null : o.key)}
    >
      <span className="sk-event__title">{o.title}</span>
      {meta && <span className="sk-event__meta">{meta}</span>}
    </button>
  );
}

/** The time, again every minute: the now line and what counts as past */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
