// Reading Business Travel through its index rather than its documents
// (processors/trip-index). Behind a remote drive the switchboard answers over
// GraphQL; with the drive in the tab's own reactor the same queries run live
// on its database. The boards show rows; a trip document is loaded only when
// it is opened.
import { useReactorClient, useRelationalQuery } from "@powerhousedao/reactor-browser";
import { indexGql as gql } from "./index-gql.js";
import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  destinationsQuery,
  foldDestinations,
  foldYears,
  searchWords,
  toTripRow,
  TRIP_PAGE,
  TRIP_PAGE_MAX,
  tripCountQuery,
  TripIndex,
  tripsQuery,
  yearsQuery,
  type DB,
  type DestinationRow,
  type TripFilter,
  type TripListRow,
  type TripPhase,
  type TripRow as TripStoredRow,
  type TripYearRow,
  type YearSource,
} from "../../../processors/trip-index/index.js";
import { useMailIndexMode } from "./mail-index.js";
import { usePagedList, type PagedList } from "./paged.js";

/** A trip as the boards list it. */
export type TripRow = TripListRow;
export type TripYear = TripYearRow;
export type TripPlace = DestinationRow;
type PlaceSource = { start_date: string | null; destinations: string };
export type { TripPhase };

export interface TripListFilter {
  /** The year a trip starts in, or every year. */
  year: number | "all";
  /** A trip matches when it is in any of these phases. */
  phases: readonly TripPhase[] | "all";
  /** The top bar's search, raw. */
  query: string;
  /** The instant the phases are measured at (ms). The list re-asks when its day changes. */
  now: number;
}

const TRIP_FIELDS = `id title status purposeKind startDate endDate travelerName destinations { city country } firstLeg { mode carrier number from to departAt } flights legs nights costTotal currency phase`;

const TRIPS_QUERY = `query ($d: String!, $y: Int, $p: [TripPhase!], $q: String, $o: Int, $l: Int, $n: String) {
  tripIndex { trips(driveId: $d, year: $y, phases: $p, query: $q, offset: $o, limit: $l, now: $n) {
    total
    items { ${TRIP_FIELDS} }
  } }
}`;

const PLACES_QUERY = `query ($d: String!, $y: Int) {
  tripIndex { places(driveId: $d, year: $y, limit: 6) { city country visits last } }
}`;

const YEARS_QUERY = `query ($d: String!) {
  tripIndex { years(driveId: $d) { year trips flights legs nights days cost billed costByKind { transport stays meals extras } } }
}`;

/** The wire speaks upper-case phases; the kit lower-case. */
type WireTrip = Omit<TripListRow, "phase"> & { phase: string };
const fromWire = (t: WireTrip): TripListRow => ({ ...t, phase: t.phase.toLowerCase() as TripPhase });

/** The trip documents of a drive changed (a trip edited, added or removed): `onChange` is called. */
function useTripChanges(enabled: boolean, onChange: () => void) {
  const client = useReactorClient();
  const ref = useRef(onChange);
  ref.current = onChange;
  useEffect(() => {
    if (!enabled || !client) return;
    try {
      return client.subscribe({ type: "sektar/trip" }, () => ref.current());
    } catch {
      // no realtime channel: the list's own poll still follows
      return undefined;
    }
  }, [enabled, client]);
}

/* --------------------------------------------------------------- local */

type LocalParams = { filter: TripFilter; limit: number };
type LocalQB = Parameters<Parameters<typeof useRelationalQuery<DB, TripStoredRow, LocalParams>>[2]>[0];

/**
 * The list over the tab's own database. A live query over the first
 * TRIP_PAGE_MAX trips: a business-travel drive is hundreds of rows, not tens
 * of thousands, so there is no window to move.
 */
function useLocalTrips(enabled: boolean, driveId: string | null, filter: TripListFilter): PagedList<TripListRow> {
  const phasesKey = filter.phases === "all" ? "all" : filter.phases.join(",");
  const params = useMemo<LocalParams>(
    () => ({
      filter: {
        year: filter.year === "all" ? null : filter.year,
        phases: filter.phases === "all" ? null : filter.phases,
        words: searchWords(filter.query),
        now: new Date(filter.now),
      },
      limit: enabled ? TRIP_PAGE_MAX : 1,
    }),
    // the instant matters at day granularity
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter.year, phasesKey, filter.query, new Date(filter.now).toISOString().slice(0, 10), enabled],
  );
  const build = useCallback(
    (db: LocalQB, p?: LocalParams) => {
      const q = p ?? params;
      return tripsQuery(db, q.filter, { limit: q.limit }).compile();
    },
    [params],
  );
  const buildCount = useCallback(
    (db: LocalQB, p?: LocalParams) => tripCountQuery(db, (p ?? params).filter).compile(),
    [params],
  );
  const rowsQ = useRelationalQuery<DB, TripStoredRow, LocalParams>(TripIndex, driveId ?? "", build, params);
  const countQ = useRelationalQuery<DB, { n: number | string }, LocalParams>(TripIndex, driveId ?? "", buildCount, params);
  const rows = useMemo(() => (rowsQ.result?.rows ?? []).map((r) => toTripRow(r, new Date(filter.now))), [rowsQ.result, filter.now]);
  const noop = useCallback(() => {}, []);
  const rowAt = useCallback((index: number) => rows[index], [rows]);
  return {
    total: Number(countQ.result?.rows[0]?.n ?? rows.length),
    rowAt,
    ensure: noop,
    loaded: enabled && Boolean(rowsQ.result),
    stale: false,
    busy: enabled && rowsQ.isLoading,
    error: rowsQ.error?.message ?? null,
    version: rows.length,
    // live queries follow the database themselves
    refreshSoon: noop,
    invalidate: noop,
  };
}

type PlaceParams = { year: number | null };
type PlaceQB = Parameters<Parameters<typeof useRelationalQuery<DB, PlaceSource, PlaceParams>>[2]>[0];

function useLocalPlaces(enabled: boolean, driveId: string | null, year: number | null): TripPlace[] | null {
  const params = useMemo<PlaceParams>(() => ({ year }), [year]);
  const build = useCallback((db: PlaceQB, p?: PlaceParams) => destinationsQuery(db, (p ?? params).year).compile(), [params]);
  const q = useRelationalQuery<DB, PlaceSource, PlaceParams>(TripIndex, enabled ? (driveId ?? "") : "", build, params);
  return useMemo(() => (enabled && q.result ? foldDestinations(q.result.rows) : null), [enabled, q.result]);
}

function useLocalYears(enabled: boolean, driveId: string | null): TripYear[] | null {
  const build = useCallback((db: LocalQB) => yearsQuery(db).compile(), []);
  const q = useRelationalQuery<DB, YearSource, LocalParams>(
    TripIndex,
    enabled ? (driveId ?? "") : "",
    build as never,
    undefined,
  );
  return useMemo(() => (enabled && q.result ? foldYears(q.result.rows) : null), [enabled, q.result]);
}

/* ---------------------------------------------------------------- api */

/** Business Travel's trips, newest start first, filtered in the index and paged where the reader is. */
export function useTripList(
  drive: DocumentDriveDocument | undefined,
  filter: TripListFilter,
): PagedList<TripListRow> & { mode: "remote" | "local" | "unknown" } {
  const mode = useMailIndexMode(drive);
  const driveId = drive?.header.id ?? null;
  const base = mode.kind === "remote" ? mode.base : null;
  const day = new Date(filter.now).toISOString().slice(0, 10);
  const phasesKey = filter.phases === "all" ? "all" : filter.phases.join(",");
  const key = JSON.stringify([base, driveId, filter.year, phasesKey, filter.query.trim().toLowerCase(), day]);
  const nowRef = useRef(filter.now);
  nowRef.current = filter.now;
  const fetchPage = useCallback(
    async (page: number) => {
      if (!base || !driveId) throw new Error("No switchboard for this drive");
      const data = await gql<{ tripIndex: { trips: { items: WireTrip[]; total: number } } }>(base, TRIPS_QUERY, {
        d: driveId,
        y: filter.year === "all" ? null : filter.year,
        p: phasesKey === "all" ? null : phasesKey.split(",").map((x) => x.toUpperCase()),
        q: filter.query.trim() || null,
        o: page * TRIP_PAGE,
        l: TRIP_PAGE,
        n: new Date(nowRef.current).toISOString(),
      });
      const { items, total } = data.tripIndex.trips;
      return { items: items.map(fromWire), total };
    },
    [base, driveId, filter.year, phasesKey, filter.query],
  );
  const remote = usePagedList<TripListRow>({
    kind: "trips",
    key,
    enabled: mode.kind === "remote" && driveId !== null,
    pageSize: TRIP_PAGE,
    fetchPage,
  });
  const local = useLocalTrips(mode.kind === "local", driveId, filter);
  const list = mode.kind === "local" ? local : remote;
  // a trip was edited: the page in view may have moved, and the year figures with it
  useTripChanges(mode.kind === "remote", remote.invalidate);
  return { ...list, mode: mode.kind };
}

/**
 * A small index answer (the per-year figures, the places): asked once, asked
 * again a beat after a trip changes and on a slow poll. `null` until known.
 */
function useRemoteAnswer<T>(base: string | null, driveId: string | null, query: string, variables: Record<string, unknown>, pick: (data: never) => T): T | null {
  const [answer, setAnswer] = useState<{ key: string; value: T } | null>(null);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify([base, driveId, query, variables]);
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    if (!base || !driveId) return;
    let active = true;
    gql<never>(base, query, { d: driveId, ...variables })
      .then((data) => {
        if (active) setAnswer({ key, value: pickRef.current(data) });
      })
      .catch(() => {
        // keep what was known; the next change or poll asks again
      });
    return () => {
      active = false;
    };
    // the key says what is asked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);
  // coalesced: a burst of edits asks once
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const soon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setTick((n) => n + 1), 800);
  }, []);
  const enabled = base !== null;
  useTripChanges(enabled, soon);
  useEffect(() => {
    if (!enabled) return;
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") setTick((n) => n + 1);
    }, 30_000);
    return () => {
      clearInterval(poll);
      clearTimeout(timer.current);
    };
  }, [enabled]);
  return answer?.key === key ? answer.value : null;
}

/** Per-year figures, newest year first; null until the index has answered. */
export function useTripYears(drive: DocumentDriveDocument | undefined): TripYear[] | null {
  const mode = useMailIndexMode(drive);
  const driveId = drive?.header.id ?? null;
  const remote = useRemoteAnswer<TripYear[]>(mode.kind === "remote" ? mode.base : null, driveId, YEARS_QUERY, {}, (data: { tripIndex: { years: TripYear[] } }) => data.tripIndex.years);
  const local = useLocalYears(mode.kind === "local", driveId);
  return mode.kind === "local" ? local : remote;
}

/** The most visited places over the trips that start in `year`, most visited first; null until known. */
export function useTripPlaces(drive: DocumentDriveDocument | undefined, year: number | "all"): TripPlace[] | null {
  const mode = useMailIndexMode(drive);
  const driveId = drive?.header.id ?? null;
  const y = year === "all" ? null : year;
  const remote = useRemoteAnswer<TripPlace[]>(mode.kind === "remote" ? mode.base : null, driveId, PLACES_QUERY, { y }, (data: { tripIndex: { places: TripPlace[] } }) => data.tripIndex.places);
  const local = useLocalPlaces(mode.kind === "local", driveId, y);
  return mode.kind === "local" ? local : remote;
}
