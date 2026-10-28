import { useState } from "react";
import { cx, Icon } from "../../sektar/kit/ui.js";
import { addDays, monthGrid, sameDay, type WeekStart } from "../week.js";
import type { CalendarPrefs } from "./prefs.js";

const MONTH_TITLE = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});
const NARROW_DAY = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });

/**
 * The sidebar with nothing selected (design system: Patterns · Calendar):
 * the mini month to jump to a week, which calendars show, how the grid
 * reads, and the calendar's settings.
 */
export function ViewOptions({
  prefs,
  setPrefs,
  days,
  today,
  onPick,
  calendars,
}: {
  prefs: CalendarPrefs;
  setPrefs: (change: Partial<CalendarPrefs>) => void;
  /** The week shown, all seven days */
  days: Date[];
  today: Date;
  onPick: (day: Date) => void;
  calendars: { key: string; label: string; slot: string; count: number }[];
}) {
  return (
    <>
      <MiniMonth
        days={days}
        today={today}
        weekStart={prefs.weekStart}
        onPick={onPick}
      />

      <div>
        <p className="sk-cal-side__label">My calendars</p>
        {calendars.length === 0 ? (
          <p className="sk-small sk-text-muted" style={{ margin: 0 }}>
            No events yet. Add a calendar integration to bring them in.
          </p>
        ) : (
          <ul className="sk-cal-list">
            {calendars.map((c) => (
              <li key={c.key} className={c.slot}>
                <label className="sk-check">
                  <input
                    type="checkbox"
                    checked={!prefs.hidden.includes(c.key)}
                    onChange={(e) =>
                      setPrefs({
                        hidden: e.target.checked
                          ? prefs.hidden.filter((k) => k !== c.key)
                          : [...prefs.hidden, c.key],
                      })
                    }
                  />
                  <span>{c.label}</span>
                </label>
                <span className="sk-cal-list__meta">{c.count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="sk-cal-side__label">View</p>
        <div className="sk-cal-settings">
          <div className="sk-cal-setting">
            <span>Time format</span>
            <div className="sk-segmented" role="group" aria-label="Time format">
              {(["24", "12"] as const).map((h) => (
                <button
                  key={h}
                  className="sk-segmented__item"
                  type="button"
                  aria-pressed={prefs.hours === h}
                  onClick={() => setPrefs({ hours: h })}
                >
                  {h} h
                </button>
              ))}
            </div>
          </div>
          <Toggle
            label="Weekends"
            checked={prefs.weekends}
            onChange={(v) => setPrefs({ weekends: v })}
          />
          <Toggle
            label="Working hours only"
            hint={prefs.hours === "24" ? "9:00 – 18:00" : "9 AM – 6 PM"}
            checked={prefs.workHours}
            onChange={(v) => setPrefs({ workHours: v })}
          />
          <Toggle
            label="Fade past events"
            checked={prefs.fadePast}
            onChange={(v) => setPrefs({ fadePast: v })}
          />
        </div>
      </div>

      <div>
        <p className="sk-cal-side__label">Settings</p>
        <div className="sk-cal-settings">
          <div className="sk-cal-setting">
            <span>Week starts on</span>
            <select
              className="sk-select"
              aria-label="Week starts on"
              value={prefs.weekStart}
              onChange={(e) =>
                setPrefs({ weekStart: Number(e.target.value) as WeekStart })
              }
            >
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
              <option value={6}>Saturday</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="sk-cal-setting">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className="sk-switch">
        <input
          type="checkbox"
          checked={checked}
          aria-label={label}
          onChange={(e) => onChange(e.target.checked)}
        />
      </span>
    </label>
  );
}

/** The month around the week shown; the week is the highlighted range, a day opens its week */
function MiniMonth({
  days,
  today,
  weekStart,
  onPick,
}: {
  days: Date[];
  today: Date;
  weekStart: WeekStart;
  onPick: (day: Date) => void;
}) {
  // The month follows the week shown until the person pages through months
  const shown = days[3];
  const [offset, setOffset] = useState({ for: shown.getTime(), months: 0 });
  const months = offset.for === shown.getTime() ? offset.months : 0;
  const month = new Date(shown.getFullYear(), shown.getMonth() + months, 1);
  const grid = monthGrid(month, weekStart);
  const first = days[0];
  const last = days[6];
  const page = (n: number) =>
    setOffset({ for: shown.getTime(), months: months + n });

  return (
    <div className="sk-minical">
      <div className="sk-minical__head">
        <span className="sk-minical__title">{MONTH_TITLE.format(month)}</span>
        <button
          className="sk-btn sk-btn--ghost sk-btn--sm sk-btn--icon"
          type="button"
          aria-label="Previous month"
          onClick={() => page(-1)}
        >
          <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
            <Icon name="chevron-right" size={16} />
          </span>
        </button>
        <button
          className="sk-btn sk-btn--ghost sk-btn--sm sk-btn--icon"
          type="button"
          aria-label="Next month"
          onClick={() => page(1)}
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
      <div className="sk-minical__grid">
        {grid.slice(0, 7).map((d) => (
          <span key={`wd-${d.getDay()}`} className="sk-minical__wd">
            {NARROW_DAY.format(d)}
          </span>
        ))}
        {grid.map((d) => {
          const inRange = d >= first && d < addDays(last, 1);
          const isToday = sameDay(d, today);
          return (
            <button
              key={d.getTime()}
              className={cx(
                "sk-minical__day",
                d.getMonth() !== month.getMonth() && "is-out",
                inRange && "is-range",
                inRange && sameDay(d, first) && "is-range-start",
                inRange && sameDay(d, last) && "is-range-end",
                isToday && "is-today",
              )}
              type="button"
              aria-current={isToday ? "date" : undefined}
              onClick={() => onPick(d)}
            >
              <span>{d.getDate()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
