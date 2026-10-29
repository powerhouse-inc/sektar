/**
 * Which events the range query hands the week, run on a real Postgres
 * (PGlite in memory) through the same Kysely builders the subgraph and the
 * local mode use, in a schema of its own as a drive's namespace is.
 *
 * `.spec.ts` so codegen never claims the filename.
 */
import { PGlite } from "@electric-sql/pglite";
import { utils, type CalendarEventState } from "document-models/calendar-event";
import {
  type DatabaseConnection,
  type Driver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryResult,
} from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addDays,
  occurrencesIn,
  sourceFromRow,
  type CalendarSource,
} from "../../editors/calendar/week.js";
import { up } from "./migrations.js";
import {
  calendarsQuery,
  eventsQuery,
  rangeOf,
  toCalendarRows,
  toEventRow,
} from "./queries.js";
import { rowFromState } from "./rows.js";
import type { DB } from "./schema.js";

/** Kysely over PGlite: one connection, queries passed straight through. */
class PGliteDriver implements Driver {
  constructor(private readonly pg: PGlite) {}
  init(): Promise<void> {
    return Promise.resolve();
  }
  acquireConnection(): Promise<DatabaseConnection> {
    const pg = this.pg;
    return Promise.resolve({
      async executeQuery<R>(query: {
        sql: string;
        parameters: readonly unknown[];
      }): Promise<QueryResult<R>> {
        const result = await pg.query<R>(query.sql, [...query.parameters]);
        return {
          rows: result.rows,
          numAffectedRows: BigInt(result.affectedRows ?? 0),
        };
      },
      streamQuery() {
        throw new Error("not used");
      },
    });
  }
  beginTransaction(): Promise<void> {
    return Promise.resolve();
  }
  commitTransaction(): Promise<void> {
    return Promise.resolve();
  }
  rollbackTransaction(): Promise<void> {
    return Promise.resolve();
  }
  releaseConnection(): Promise<void> {
    return Promise.resolve();
  }
  destroy(): Promise<void> {
    return Promise.resolve();
  }
}

const pg = new PGlite();
const base = new Kysely<DB>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new PGliteDriver(pg),
    createIntrospector: (k) => new PostgresIntrospector(k),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});
// A drive's namespace is a schema of its own; the series subquery must follow it.
const db = base.withSchema("drive_ns");

const AT = "2026-10-20T08:00:00.000Z";
const CAL = { id: "primary", name: "Me", account: "me@x.be" };

function event(id: string, partial: Partial<CalendarEventState>): CalendarSource {
  return {
    documentId: id,
    state: {
      ...utils.createDocument().state.global,
      calendar: CAL,
      uid: `${id}@google.com`,
      ...partial,
    },
  };
}

const timed = (start: string, end: string) => ({
  start: { at: start, date: null, timeZone: null },
  end: { at: end, date: null, timeZone: null },
});

const day = (start: string, end: string) => ({
  allDay: true,
  start: { at: null, date: start, timeZone: null },
  end: { at: null, date: end, timeZone: null },
});

// The asked range: the week of Monday 26 October 2026, in UTC.
const FROM = "2026-10-26T00:00:00.000Z";
const TO = "2026-11-02T00:00:00.000Z";

const sources: CalendarSource[] = [
  event("inside", timed("2026-10-27T09:00:00Z", "2026-10-27T10:00:00Z")),
  event("before", timed("2026-10-20T09:00:00Z", "2026-10-20T10:00:00Z")),
  event("after", timed("2026-11-03T09:00:00Z", "2026-11-03T10:00:00Z")),
  event("ends-at-from", timed("2026-10-25T23:00:00Z", "2026-10-26T00:00:00Z")),
  event("spans-in", timed("2026-10-24T09:00:00Z", "2026-10-26T10:00:00Z")),
  event("holiday", day("2026-10-30", "2026-10-31")),
  event("no-start", { start: null, end: null }),
  event("weekly", {
    ...timed("2026-01-05T09:00:00Z", "2026-01-05T09:30:00Z"),
    recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"],
  }),
  event("ended", {
    ...timed("2026-01-05T09:00:00Z", "2026-01-05T09:30:00Z"),
    recurrence: ["RRULE:FREQ=WEEKLY;UNTIL=20260301T000000Z"],
  }),
  event("counted", {
    ...timed("2026-01-01T09:00:00Z", "2026-01-01T09:30:00Z"),
    recurrence: ["RRULE:FREQ=DAILY;COUNT=3"],
  }),
  event("starts-later", {
    ...timed("2026-12-01T09:00:00Z", "2026-12-01T09:30:00Z"),
    recurrence: ["RRULE:FREQ=DAILY"],
  }),
  event("monthly-days", {
    ...day("2026-01-28", "2026-01-29"),
    recurrence: ["RRULE:FREQ=MONTHLY"],
  }),
  // Changed occurrences of "weekly": moved far away, and cancelled.
  event("weekly-moved", {
    ...timed("2026-12-24T15:00:00Z", "2026-12-24T15:30:00Z"),
    recurrenceId: "2026-10-28T09:00:00Z",
  }),
  event("weekly-cancelled", {
    ...timed("2026-10-26T09:00:00Z", "2026-10-26T09:30:00Z"),
    recurrenceId: "2026-10-26T09:00:00Z",
    status: "CANCELLED",
  }),
  // A changed occurrence of a series that cannot reach the range.
  event("ended-moved", {
    ...timed("2026-02-10T09:00:00Z", "2026-02-10T09:30:00Z"),
    recurrenceId: "2026-02-09T09:00:00Z",
  }),
  event("other-cal", {
    ...timed("2026-10-28T12:00:00Z", "2026-10-28T13:00:00Z"),
    calendar: { id: "team", name: "Team", account: "me@x.be" },
  }),
];

// Changed occurrences share their series' uid.
for (const s of sources) {
  if (s.documentId.startsWith("weekly-")) s.state.uid = "weekly@google.com";
  if (s.documentId === "ended-moved") s.state.uid = "ended@google.com";
}

beforeAll(async () => {
  await base.schema.createSchema("drive_ns").execute();
  await up(db);
  await db
    .insertInto("calendar_index")
    .values(
      sources.map((s) =>
        rowFromState(s.documentId, JSON.parse(JSON.stringify(s.state)) as Record<string, unknown>, AT),
      ),
    )
    .execute();
});

afterAll(async () => {
  await base.destroy();
  await pg.close();
});

async function idsIn(from: string, to: string): Promise<string[]> {
  const rows = await eventsQuery(db, rangeOf(from, to)!).execute();
  return rows.map((r) => r.document_id).sort();
}

describe("eventsQuery", () => {
  it("hands over the overlapping events, the live series and their changed occurrences", async () => {
    expect(await idsIn(FROM, TO)).toEqual(
      [
        "holiday",
        "inside",
        "monthly-days",
        "other-cal",
        "spans-in",
        "weekly",
        "weekly-cancelled",
        "weekly-moved",
      ].sort(),
    );
  });

  it("follows the range", async () => {
    const ids = await idsIn("2026-12-01T00:00:00.000Z", "2026-12-02T00:00:00.000Z");
    expect(ids).toContain("starts-later");
    expect(ids).toContain("weekly");
    expect(ids).not.toContain("inside");
    // February: "ended" still runs and brings its changed occurrence; "counted" is over
    const feb = await idsIn("2026-02-09T00:00:00.000Z", "2026-02-10T00:00:00.000Z");
    expect(feb).toEqual([
      "ended",
      "ended-moved",
      "monthly-days",
      "weekly",
      "weekly-cancelled",
      "weekly-moved",
    ]);
  });

  it("refuses an empty or unreadable range", () => {
    expect(rangeOf(TO, FROM)).toBeNull();
    expect(rangeOf("soon", TO)).toBeNull();
  });
});

describe("the week from the index", () => {
  it("shows what the week over every document shows", async () => {
    // As the kit asks: the local week, widened by a day on each side.
    const weekStart = new Date(2026, 9, 26);
    const weekEnd = addDays(weekStart, 7);
    const range = rangeOf(weekStart.getTime() - 86_400_000, weekEnd.getTime() + 86_400_000)!;
    const rows = await eventsQuery(db, range).execute();
    const fromIndex = occurrencesIn(
      rows.map((r) => sourceFromRow(toEventRow(r))),
      weekStart,
      weekEnd,
    );
    const fromDocuments = occurrencesIn(sources, weekStart, weekEnd);
    const shape = (o: (typeof fromIndex)[number]) => ({
      key: o.key,
      calendar: o.calendar,
      title: o.title,
      start: o.start.getTime(),
      end: o.end.getTime(),
      allDay: o.allDay,
      free: o.free,
      tentative: o.tentative,
      repeats: o.repeats,
    });
    expect(fromIndex.map(shape)).toEqual(fromDocuments.map(shape));
    expect(fromIndex.length).toBeGreaterThan(4);
  });
});

describe("calendarsQuery", () => {
  it("lists every calendar with its events", async () => {
    const rows = toCalendarRows(await calendarsQuery(db).execute());
    expect(rows.sort((a, b) => a.key.localeCompare(b.key))).toEqual([
      { key: "me@x.be|primary", label: "Me", events: sources.length - 1 },
      { key: "me@x.be|team", label: "Team", events: 1 },
    ]);
  });
});
