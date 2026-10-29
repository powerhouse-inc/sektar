// The questions Business Travel asks of the trip index, as queries over it.
// Shared by the subgraph (the switchboard answers Connect over GraphQL) and
// by a tab whose own reactor runs the processor (a live query), so the two
// never disagree on what "upcoming" or "a match" means.
// The declarations name kysely's builder types (these queries return them):
// importing the package lets tsc refer to "kysely", not to a path into .pnpm.
import type {} from "kysely";
import type { IRelationalDb } from "@powerhousedao/reactor-browser";
import { tripPhase, type Leg, type TripPhase } from "./rows.js";
import type { DB, TripRow } from "./schema.js";

/** What both a namespaced query builder and a Kysely instance offer. */
export type TripQueryBuilder = Pick<IRelationalDb<DB>, "selectFrom">;

export interface TripFilter {
  /** The year a trip starts in. */
  year?: number | null;
  /** A trip matches when it is in any of these phases; empty or absent is every phase. */
  phases?: readonly TripPhase[] | null;
  /** Lower-cased words, each of which must appear in the row's search text. */
  words?: readonly string[];
  /** The instant "upcoming", "ongoing" and "completed" are measured at. */
  now: Date;
}

export const TRIP_PAGE = 50;
export const TRIP_PAGE_MAX = 500;

export const TRIP_PHASES: readonly TripPhase[] = [
  "upcoming",
  "ongoing",
  "completed",
  "cancelled",
  "undated",
];

/** A trip as the list shows it: the row, in the subgraph's vocabulary. */
export interface TripListRow {
  id: string;
  title: string | null;
  status: string;
  purposeKind: string | null;
  startDate: string | null;
  endDate: string | null;
  travelerName: string | null;
  destinations: { city: string; country: string | null }[];
  firstLeg: Leg | null;
  flights: number;
  legs: number;
  nights: number;
  costTotal: number;
  currency: string;
  phase: TripPhase;
}

export interface TripPageResult {
  items: TripListRow[];
  total: number;
}

export interface CostByKind {
  transport: number;
  stays: number;
  meals: number;
  extras: number;
}

export interface TripYearRow {
  year: number;
  trips: number;
  flights: number;
  legs: number;
  nights: number;
  days: number;
  cost: number;
  billed: number;
  costByKind: CostByKind;
}

/** The words of a search, lower-cased, at most `max` of them. */
export function searchWords(
  query: string | null | undefined,
  max = 6,
): string[] {
  return (query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, max);
}

/** LIKE's own wildcards are dropped from a word: a search is for text, not patterns. */
function likeWord(word: string): string {
  return `%${word.replace(/[%_\\]/g, "")}%`;
}

/** The day `now` falls on, YYYY-MM-DD in UTC, as the phase rule measures. */
const todayOf = (now: Date) => now.toISOString().slice(0, 10);

/**
 * The trips the filters match. `phase` is a WHERE clause over the dates with
 * `now` as its only input, the way `isOverdue` is for invoices; it agrees
 * with `tripPhase` (and the kit's `phaseOf`) for every row.
 */
function filtered(db: TripQueryBuilder, f: TripFilter) {
  const today = todayOf(f.now);
  let q = db.selectFrom("trip_index");
  if (f.year != null) {
    q = q.where("start_date", "like", `${String(f.year).padStart(4, "0")}-%`);
  }
  const phases = f.phases ?? [];
  if (phases.length) {
    q = q.where((eb) => {
      const condition = (phase: TripPhase) => {
      switch (phase) {
        case "cancelled":
          return eb("status", "=", "CANCELLED");
        case "undated":
          return eb.and([
            eb("status", "<>", "CANCELLED"),
            eb("status", "<>", "COMPLETED"),
            eb("start_date", "is", null),
          ]);
        case "upcoming":
          return eb.and([eb("status", "<>", "CANCELLED"), eb("start_date", ">", today)]);
        case "ongoing":
          return eb.and([
            eb("status", "<>", "CANCELLED"),
            eb("start_date", "<=", today),
            eb.or([
              eb("end_date", ">=", today),
              eb.and([eb("end_date", "is", null), eb("start_date", ">=", today)]),
            ]),
          ]);
        case "completed":
          return eb.and([
            eb("status", "<>", "CANCELLED"),
            eb.or([
              eb.and([eb("start_date", "is", null), eb("status", "=", "COMPLETED")]),
              eb.and([
                eb("end_date", "is not", null),
                eb("start_date", "<=", today),
                eb("end_date", "<", today),
              ]),
              eb.and([eb("end_date", "is", null), eb("start_date", "<", today)]),
            ]),
          ]);
      }
      };
      return eb.or(phases.map(condition));
    });
  }
  for (const word of f.words ?? []) {
    if (word) q = q.where("search_text", "like", likeWord(word));
  }
  return q;
}

/** One page, newest start first, undated trips last, from row `offset`. */
export function tripsQuery(
  db: TripQueryBuilder,
  f: TripFilter,
  page: { offset?: number | null; limit: number },
) {
  const ordered = filtered(db, f)
    .selectAll()
    .orderBy("start_date", (ob) => ob.desc().nullsLast())
    .orderBy("title", "asc")
    .orderBy("document_id", "desc")
    .limit(page.limit);
  return page.offset ? ordered.offset(page.offset) : ordered;
}

/** How many trips the filters match. */
export function tripCountQuery(db: TripQueryBuilder, f: TripFilter) {
  return filtered(db, f).select((eb) => eb.fn.countAll<number>().as("n"));
}

/** What each year's figures are built from: every dated trip that is not cancelled. */
export function yearsQuery(db: TripQueryBuilder) {
  return db
    .selectFrom("trip_index")
    .where("status", "<>", "CANCELLED")
    .where("start_date", "is not", null)
    .select([
      "start_date",
      "flights",
      "legs",
      "nights",
      "days",
      "cost_total",
      "billed_total",
      "cost_transport",
      "cost_stays",
      "cost_meals",
      "cost_extras",
    ]);
}

export interface YearSource {
  start_date: string | null;
  flights: number | string;
  legs: number | string;
  nights: number | string;
  days: number | string;
  cost_total: number | string;
  billed_total: number | string;
  cost_transport: number | string;
  cost_stays: number | string;
  cost_meals: number | string;
  cost_extras: number | string;
}

/** The per-year figures folded from `yearsQuery`'s rows, newest year first. */
export function foldYears(rows: readonly YearSource[]): TripYearRow[] {
  const map = new Map<number, TripYearRow>();
  for (const r of rows) {
    if (!r.start_date) continue;
    const year = Number(r.start_date.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    const y = map.get(year) ?? {
      year,
      trips: 0,
      flights: 0,
      legs: 0,
      nights: 0,
      days: 0,
      cost: 0,
      billed: 0,
      costByKind: { transport: 0, stays: 0, meals: 0, extras: 0 },
    };
    y.trips += 1;
    y.flights += Number(r.flights);
    y.legs += Number(r.legs);
    y.nights += Number(r.nights);
    y.days += Number(r.days);
    y.cost += Number(r.cost_total);
    y.billed += Number(r.billed_total);
    y.costByKind.transport += Number(r.cost_transport);
    y.costByKind.stays += Number(r.cost_stays);
    y.costByKind.meals += Number(r.cost_meals);
    y.costByKind.extras += Number(r.cost_extras);
    map.set(year, y);
  }
  return [...map.values()]
    .map((y) => ({
      ...y,
      cost: Math.round(y.cost * 100) / 100,
      billed: Math.round(y.billed * 100) / 100,
      costByKind: {
        transport: Math.round(y.costByKind.transport * 100) / 100,
        stays: Math.round(y.costByKind.stays * 100) / 100,
        meals: Math.round(y.costByKind.meals * 100) / 100,
        extras: Math.round(y.costByKind.extras * 100) / 100,
      },
    }))
    .sort((a, b) => b.year - a.year);
}

function parseJson<T>(text: string | null, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** A stored row in the list's vocabulary, its phase measured at `now`. */
export function toTripRow(r: TripRow, now: Date = new Date()): TripListRow {
  return {
    id: r.document_id,
    title: r.title,
    status: r.status,
    purposeKind: r.purpose_kind,
    startDate: r.start_date,
    endDate: r.end_date,
    travelerName: r.traveler_name,
    destinations: parseJson<{ city: string; country: string | null }[]>(
      r.destinations,
      [],
    ),
    firstLeg: parseJson<Leg | null>(r.first_leg, null),
    flights: Number(r.flights),
    legs: Number(r.legs),
    nights: Number(r.nights),
    costTotal: Number(r.cost_total),
    currency: r.currency,
    phase: tripPhase(r, now.getTime()),
  };
}

/** What the most-visited places are counted from: every dated trip that is not cancelled. */
export function destinationsQuery(db: TripQueryBuilder, year?: number | null) {
  let q = db
    .selectFrom("trip_index")
    .where("status", "<>", "CANCELLED")
    .select(["start_date", "destinations"]);
  if (year != null) {
    q = q.where("start_date", "like", `${String(year).padStart(4, "0")}-%`);
  }
  return q;
}

export interface DestinationRow {
  city: string;
  country: string | null;
  visits: number;
  /** The latest start date among the trips that went there. */
  last: string | null;
}

/** The places visited, most visited first, then most recent. */
export function foldDestinations(
  rows: readonly { start_date: string | null; destinations: string }[],
  limit = 6,
): DestinationRow[] {
  const map = new Map<string, DestinationRow>();
  for (const r of rows) {
    for (const d of parseJson<{ city: string; country: string | null }[]>(r.destinations, [])) {
      const key = d.city.toLowerCase();
      const row = map.get(key) ?? { city: d.city, country: d.country ?? null, visits: 0, last: null };
      row.visits += 1;
      if (r.start_date && (!row.last || r.start_date > row.last)) row.last = r.start_date;
      map.set(key, row);
    }
  }
  return [...map.values()]
    .sort((a, b) => b.visits - a.visits || (b.last ?? "").localeCompare(a.last ?? ""))
    .slice(0, limit);
}
