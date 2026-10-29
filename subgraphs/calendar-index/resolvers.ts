/**
 * Reading the calendar index.
 *
 * Read-only by design: the index says what the Calendar drive holds, never
 * changes it. Events change at the provider and arrive as documents; the
 * processor brings the index up to date behind them.
 *
 * Access is declared in index.ts and applied by the subgraph wrapper: every
 * query goes through `restrict`.
 */
import type { IndexQuery } from "@powerhousedao/reactor-api";
import {
  calendarsQuery,
  type CalendarEventListRow,
  type CalendarIndex,
  type CalendarListRow,
  eventsQuery,
  rangeOf,
  toCalendarRows,
  toEventRow,
} from "processors/calendar-index";

type Db = CalendarIndex["query"];

interface EventsArgs {
  driveId: string;
  from: string;
  to: string;
}

async function events({
  db,
  args,
  restrict,
}: IndexQuery<Db, EventsArgs>): Promise<CalendarEventListRow[]> {
  const range = rangeOf(args.from, args.to);
  if (!range) throw new Error("events: from and to must be instants, from before to");
  const rows = await restrict(eventsQuery(db, range)).execute();
  return rows.map(toEventRow);
}

async function calendars({
  db,
  restrict,
}: IndexQuery<Db, { driveId: string }>): Promise<CalendarListRow[]> {
  return toCalendarRows(await restrict(calendarsQuery(db)).execute());
}

export const resolvers = {
  Query: {
    calendarIndex: () => ({}),
  },
};

export const queries = {
  "CalendarIndexQueries.events": events,
  "CalendarIndexQueries.calendars": calendars,
};
