/**
 * The calendar index: one row per sektar/calendar-event document.
 *
 * The Calendar app shows a week: which events fall in it (a series expanded
 * in the browser, its changed and cancelled occurrences applied), the
 * calendars and their colours, and the summary of the event picked. None of
 * that needs the attendee list or the description, so the row keeps what the
 * grid, the calendar list and the summary show, and what the range question
 * needs. Rows come off `operation.context.resultingState` (see `rows.ts`); no
 * document is loaded.
 */
export interface CalendarRow {
  document_id: string;
  /** `<account>|<calendar id>`: the calendar the event is on (week.ts `calendarKey`). */
  calendar_key: string;
  calendar_id: string | null;
  calendar_account: string | null;
  calendar_name: string | null;
  /** The calendar's name, else its account, else its id, else "Calendar". */
  calendar_label: string;
  /** The event's summary. */
  title: string | null;
  location: string | null;
  meeting_url: string | null;
  /**
   * The first start as a UTC instant (toISOString), sortable as text. A
   * whole-day event's date reads as UTC midnight: the browser places it at
   * its own midnight, so a range asked of the index is widened by a day.
   */
  start_at: string | null;
  /** The end, exclusive, on the same terms; never before the start (week.ts `bounds`). */
  end_at: string | null;
  /** A whole-day event's own start date, yyyy-mm-dd. */
  start_date: string | null;
  /** A whole-day event's own end date (exclusive), yyyy-mm-dd. */
  end_date: string | null;
  /** The zone the event was planned in, e.g. Europe/Brussels. */
  time_zone: string | null;
  all_day: boolean;
  busy: boolean;
  /** Not settled: the event is tentative, or the account has not said yes. */
  tentative: boolean;
  /** CONFIRMED | TENTATIVE | CANCELLED */
  status: string;
  /** A series: no recurrence id and an RRULE the week view can expand. */
  repeats: boolean;
  /** JSON: the RRULE, EXDATE and RDATE lines. */
  recurrence: string;
  /** For a changed occurrence of a series: the original start it replaces. */
  recurrence_id: string | null;
  uid: string | null;
  /** `<calendar_key>|<uid>`: ties a series and its changed occurrences. Null without a uid. */
  series_id: string | null;
  /**
   * For a series: an instant no occurrence ends after (UNTIL, or a bound on
   * COUNT), with a day to spare. Null when the series never ends.
   */
  series_end: string | null;
  organizer_name: string | null;
  organizer_email: string | null;
  updated_at: string;
}

export interface DB {
  calendar_index: CalendarRow;
}
