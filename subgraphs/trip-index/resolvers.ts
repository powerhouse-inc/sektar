/**
 * Reading the trip index.
 *
 * Read-only by design: the index says what the Trips drive holds, never
 * changes it. Edits go through the documents, and the processor brings the
 * index up to date behind it.
 */
import { type BaseSubgraph } from "@powerhousedao/reactor-api";
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
  TripIndex,
  tripsQuery,
  yearsQuery,
  type TripPageResult,
  type TripPhase,
  type TripYearRow,
} from "processors/trip-index";

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

export const getResolvers = (
  subgraph: BaseSubgraph,
): Record<string, unknown> => {
  async function trips(args: TripsArgs): Promise<TripPageResult> {
    const db = TripIndex.query(args.driveId, subgraph.relationalDb);
    const now = instant(args.now);
    const asked = args.phases?.length ? args.phases : args.phase ? [args.phase] : [];
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
      tripsQuery(db, filter, {
        offset: Math.max(0, Math.floor(args.offset ?? 0)),
        limit,
      }).execute(),
      tripCountQuery(db, filter).executeTakeFirst(),
    ]);
    return {
      items: rows.map((r) => toTripRow(r, now)),
      total: Number(count?.n ?? 0),
    };
  }

  async function years(driveId: string): Promise<TripYearRow[]> {
    const db = TripIndex.query(driveId, subgraph.relationalDb);
    return foldYears(await yearsQuery(db).execute());
  }

  async function places(driveId: string, year: number | null, limit: number) {
    const db = TripIndex.query(driveId, subgraph.relationalDb);
    return foldDestinations(
      await destinationsQuery(db, year).execute(),
      Math.min(Math.max(limit, 1), 50),
    );
  }

  return {
    Query: {
      tripIndex: () => ({}),
    },
    TripRow: {
      // The enum is upper-case on the wire, lower-case in the kit.
      phase: (row: { phase: string }) => row.phase.toUpperCase(),
    },
    TripIndexQueries: {
      trips: (_parent: unknown, args: TripsArgs) => trips(args),
      years: (_parent: unknown, args: { driveId: string }) =>
        years(args.driveId),
      places: (
        _parent: unknown,
        args: { driveId: string; year?: number | null; limit?: number | null },
      ) => places(args.driveId, args.year ?? null, args.limit ?? 6),
    },
  };
};
