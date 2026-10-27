/**
 * Reading the trip index.
 *
 * Read-only by design: the index says what the Trips drive holds, never
 * changes it. Edits go through the documents, and the processor brings the
 * index up to date behind it.
 *
 * Access is declared in index.ts and applied by the subgraph wrapper: every
 * query goes through `restrict`.
 */
import type { IndexQuery } from "@powerhousedao/reactor-api";
import {
  destinationsQuery,
  foldDestinations,
  foldYears,
  searchWords,
  toTripRow,
  TRIP_PAGE,
  TRIP_PAGE_MAX,
  TRIP_PHASES,
  tripCountQuery,
  type TripIndex,
  tripsQuery,
  yearsQuery,
  type TripPageResult,
  type TripPhase,
  type TripYearRow,
} from "processors/trip-index";

type Db = TripIndex["query"];

interface TripsArgs {
  driveId: string;
  year?: number | null;
  phase?: string | null;
  phases?: string[] | null;
  query?: string | null;
  offset?: number | null;
  limit?: number | null;
  now?: string | null;
}

/** The request's instant; the server's clock when absent or unreadable. */
function instant(now: string | null | undefined): Date {
  if (now) {
    const at = new Date(now);
    if (!Number.isNaN(at.getTime())) return at;
  }
  return new Date();
}

async function trips({
  db,
  args,
  restrict,
}: IndexQuery<Db, TripsArgs>): Promise<TripPageResult> {
  const now = instant(args.now);
  const asked = args.phases?.length
    ? args.phases
    : args.phase
      ? [args.phase]
      : [];
  const phases = asked
    .map((p) => p.toLowerCase() as TripPhase)
    .filter((p) => TRIP_PHASES.includes(p));
  const filter = {
    year: args.year ?? null,
    phases,
    words: searchWords(args.query),
    now,
  };
  const limit = Math.min(Math.max(args.limit ?? TRIP_PAGE, 1), TRIP_PAGE_MAX);
  const [rows, count] = await Promise.all([
    restrict(
      tripsQuery(db, filter, {
        offset: Math.max(0, Math.floor(args.offset ?? 0)),
        limit,
      }),
    ).execute(),
    restrict(tripCountQuery(db, filter)).executeTakeFirst(),
  ]);
  return {
    items: rows.map((r) => toTripRow(r, now)),
    total: Number(count?.n ?? 0),
  };
}

async function years({
  db,
  restrict,
}: IndexQuery<Db, { driveId: string }>): Promise<TripYearRow[]> {
  return foldYears(await restrict(yearsQuery(db)).execute());
}

async function places({
  db,
  args,
  restrict,
}: IndexQuery<
  Db,
  { driveId: string; year?: number | null; limit?: number | null }
>) {
  return foldDestinations(
    await restrict(destinationsQuery(db, args.year ?? null)).execute(),
    Math.min(Math.max(args.limit ?? 6, 1), 50),
  );
}

export const resolvers = {
  Query: {
    tripIndex: () => ({}),
  },
  TripRow: {
    // The enum is upper-case on the wire, lower-case in the kit.
    phase: (row: { phase: string }) => row.phase.toUpperCase(),
  },
};

export const queries = {
  "TripIndexQueries.trips": trips,
  "TripIndexQueries.years": years,
  "TripIndexQueries.places": places,
};
