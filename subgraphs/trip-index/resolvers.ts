/**
 * Reading the trip index.
 *
 * Read-only by design: the index says what the Trips drive holds, never
 * changes it. Edits go through the documents, and the processor brings the
 * index up to date behind it.
 *
 * Access: a trip row is one document (`document_id`); the years and places
 * derive from those rows. All are filtered through the host's readable
 * documents read model for the caller once the drive passed (`indexAccess`).
 */
import {
  applyReadableFilter,
  type BaseSubgraph,
  type Context,
} from "@powerhousedao/reactor-api";
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
  async function trips(ctx: Context, args: TripsArgs): Promise<TripPageResult> {
    const access = await subgraph.indexAccess(ctx, args.driveId);
    if (access.kind === "none") return { items: [], total: 0 };
    const db = TripIndex.query(args.driveId, subgraph.relationalDb);
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
      applyReadableFilter(
        tripsQuery(db, filter, {
          offset: Math.max(0, Math.floor(args.offset ?? 0)),
          limit,
        }),
        "document_id",
        access,
      ).execute(),
      applyReadableFilter(
        tripCountQuery(db, filter),
        "document_id",
        access,
      ).executeTakeFirst(),
    ]);
    return {
      items: rows.map((r) => toTripRow(r, now)),
      total: Number(count?.n ?? 0),
    };
  }

  async function years(ctx: Context, driveId: string): Promise<TripYearRow[]> {
    const access = await subgraph.indexAccess(ctx, driveId);
    if (access.kind === "none") return [];
    const db = TripIndex.query(driveId, subgraph.relationalDb);
    return foldYears(
      await applyReadableFilter(
        yearsQuery(db),
        "document_id",
        access,
      ).execute(),
    );
  }

  async function places(
    ctx: Context,
    driveId: string,
    year: number | null,
    limit: number,
  ) {
    const access = await subgraph.indexAccess(ctx, driveId);
    if (access.kind === "none") return [];
    const db = TripIndex.query(driveId, subgraph.relationalDb);
    return foldDestinations(
      await applyReadableFilter(
        destinationsQuery(db, year),
        "document_id",
        access,
      ).execute(),
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
      trips: (_parent: unknown, args: TripsArgs, ctx: Context) =>
        trips(ctx, args),
      years: (_parent: unknown, args: { driveId: string }, ctx: Context) =>
        years(ctx, args.driveId),
      places: (
        _parent: unknown,
        args: { driveId: string; year?: number | null; limit?: number | null },
        ctx: Context,
      ) => places(ctx, args.driveId, args.year ?? null, args.limit ?? 6),
    },
  };
};
