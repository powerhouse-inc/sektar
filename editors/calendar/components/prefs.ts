import { useState } from "react";
import type { HourFormat, WeekStart } from "../week.js";

/** How this person likes the week: kept in this browser only */
export type CalendarPrefs = {
  weekStart: WeekStart;
  hours: HourFormat;
  weekends: boolean;
  workHours: boolean;
  fadePast: boolean;
  /** Calendars (calendarKey) left out of the grid */
  hidden: string[];
};

const KEY = "sk:calendar-prefs";

const DEFAULTS: CalendarPrefs = {
  weekStart: 1,
  hours: "24",
  weekends: true,
  workHours: false,
  fadePast: true,
  hidden: [],
};

function read(): CalendarPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<CalendarPrefs>) };
  } catch {
    return DEFAULTS;
  }
}

export function useCalendarPrefs(): [
  CalendarPrefs,
  (change: Partial<CalendarPrefs>) => void,
] {
  const [prefs, setPrefs] = useState(read);
  const update = (change: Partial<CalendarPrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...change };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // remembered only when storage is available
      }
      return next;
    });
  };
  return [prefs, update];
}
