// Turns a trip document's state into its index row. Pure, shared by the
// processor and its tests. The state arrives as the operation's
// `resultingState`; no document is loaded.
import type { TripRow } from "./schema.js";

type Json = Record<string, unknown>;

export type TripPhase =
  | "upcoming"
  | "ongoing"
  | "completed"
  | "cancelled"
  | "undated";

const DAY = 86_400_000;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const objects = (v: unknown): Json[] =>
  Array.isArray(v)
    ? v.filter((x): x is Json => Boolean(x) && typeof x === "object")
    : [];

const round2 = (n: number) =>
  (Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-9)) / 100;

/** The day part of a Date or DateTime string. */
const dayPart = (v: unknown): string | null => {
  const s = str(v);
  return s ? s.slice(0, 10) : null;
};

const dayMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

/**
 * What a trip is at `now`: its own status, or what its dates say. The same
 * rule as `phaseOf` in `editors/sektar/kit/trips.ts`.
 */
export function tripPhase(
  s: { status: string; start_date: string | null; end_date: string | null },
  now: number = Date.now(),
): TripPhase {
  if (s.status === "CANCELLED") return "cancelled";
  if (!s.start_date) return s.status === "COMPLETED" ? "completed" : "undated";
  const start = Date.parse(`${s.start_date.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(
    `${(s.end_date ?? s.start_date).slice(0, 10)}T23:59:59Z`,
  );
  if (now < start) return "upcoming";
  if (now <= end) return "ongoing";
  return "completed";
}

/** A cost in the trip's currency: its amount, its converted amount, or nothing known. */
function inTripCurrency(cost: unknown, currency: string): number | null {
  if (!cost || typeof cost !== "object") return null;
  const c = cost as Json;
  if (c.currency === currency) return num(c.amount);
  return num(c.converted);
}

/** Nights over the stays: check-out minus check-in, never negative. */
export function nightsOf(stays: readonly Json[]): number {
  let n = 0;
  for (const st of stays) {
    const a = dayPart(st.checkIn);
    const b = dayPart(st.checkOut);
    if (a && b) n += Math.max(0, Math.round((dayMs(b) - dayMs(a)) / DAY));
  }
  return n;
}

export interface Leg {
  mode: string | null;
  carrier: string | null;
  number: string | null;
  from: string | null;
  to: string | null;
  departAt: string | null;
}

/** The earliest leg by departure; legs without one follow, in order. */
export function firstLegOf(legs: readonly Json[]): Leg | null {
  let best: Json | null = null;
  for (const l of legs) {
    if (!best) {
      best = l;
      continue;
    }
    const a = str(l.departAt);
    const b = str(best.departAt);
    if (a && (!b || a < b)) best = l;
  }
  if (!best) return null;
  return {
    mode: str(best.mode),
    carrier: str(best.carrier),
    number: str(best.number),
    from: str(best.from),
    to: str(best.to),
    departAt: str(best.departAt),
  };
}

/** The costs of a trip, in its currency: everything, and what is billed on. */
export function costsOf(
  state: Json,
  currency: string,
): {
  total: number;
  billed: number;
  byKind: { transport: number; stays: number; meals: number; extras: number };
} {
  let billed = 0;
  const byKind = { transport: 0, stays: 0, meals: 0, extras: 0 };
  for (const key of ["transport", "stays", "meals", "extras"] as const) {
    for (const item of objects(state[key])) {
      const v = inTripCurrency(item.cost, currency);
      if (v === null) continue;
      byKind[key] += v;
      if (item.invoice) billed += v;
    }
  }
  const kinds = {
    transport: round2(byKind.transport),
    stays: round2(byKind.stays),
    meals: round2(byKind.meals),
    extras: round2(byKind.extras),
  };
  return {
    total: round2(
      kinds.transport + kinds.stays + kinds.meals + kinds.extras,
    ),
    billed: round2(billed),
    byKind: kinds,
  };
}

/** A row for a document nothing has been applied to yet. */
export function emptyRow(documentId: string, at: string): TripRow {
  return {
    document_id: documentId,
    title: null,
    status: "PLANNED",
    purpose_kind: null,
    start_date: null,
    end_date: null,
    traveler_name: null,
    destinations: "[]",
    first_leg: null,
    flights: 0,
    legs: 0,
    nights: 0,
    days: 1,
    cost_total: 0,
    billed_total: 0,
    cost_transport: 0,
    cost_stays: 0,
    cost_meals: 0,
    cost_extras: 0,
    currency: "EUR",
    search_text: "",
    updated_at: at,
  };
}

/** The row for a whole document from its global state. */
export function rowFromState(
  documentId: string,
  state: Json,
  at: string,
): TripRow {
  const currency = str(state.currency) ?? "EUR";
  const start = dayPart(state.startDate);
  const end = dayPart(state.endDate);
  const destinations = objects(state.destinations)
    .map((d) => ({ city: str(d.city), country: str(d.country) }))
    .filter((d): d is { city: string; country: string | null } =>
      Boolean(d.city),
    );
  const stays = objects(state.stays);
  const legs = objects(state.transport);
  const traveler = (state.traveler ?? {}) as Json;
  const billing = (state.billing ?? {}) as Json;
  const costs = costsOf(state, currency);
  const title = str(state.title);
  const travelerName = str(traveler.name);
  return {
    document_id: documentId,
    title,
    status: str(state.status) ?? "PLANNED",
    purpose_kind: str(state.purposeKind),
    start_date: start,
    end_date: end,
    traveler_name: travelerName,
    destinations: JSON.stringify(destinations),
    first_leg: legs.length ? JSON.stringify(firstLegOf(legs)) : null,
    flights: legs.filter((l) => l.mode === "FLIGHT").length,
    legs: legs.length,
    nights: nightsOf(stays),
    days:
      start && end
        ? Math.max(1, Math.round((dayMs(end) - dayMs(start)) / DAY) + 1)
        : 1,
    cost_total: costs.total,
    billed_total: costs.billed,
    cost_transport: costs.byKind.transport,
    cost_stays: costs.byKind.stays,
    cost_meals: costs.byKind.meals,
    cost_extras: costs.byKind.extras,
    currency,
    search_text: [
      title,
      str(state.purpose),
      str(billing.customerName),
      travelerName,
      ...destinations.flatMap((d) => [d.city, d.country]),
      ...stays.map((x) => str(x.name)),
      ...legs.map((x) => str(x.carrier)),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    updated_at: at,
  };
}

/** The scope's state out of an operation's `resultingState`, if it carries one. */
export function parseState(json: string | undefined | null): Json | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object") {
      // resultingState is the scope's state; some transports wrap it per scope.
      const obj = parsed as Json;
      return obj.global && typeof obj.global === "object"
        ? (obj.global as Json)
        : obj;
    }
  } catch {
    // not JSON: the caller leaves the row as it is
  }
  return null;
}
