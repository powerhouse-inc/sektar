import type {
  TripCost,
  TripExtra,
  TripMeal,
  TripState,
  TripStay,
  TripTransport,
} from "document-models/trip/v1";

const round2 = (n: number) =>
  (Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-9)) / 100;

/** A cost in the trip's currency: its amount, its converted amount, or nothing known. */
export function inTripCurrency(
  cost: TripCost | null | undefined,
  tripCurrency: string,
): number | null {
  if (!cost) return null;
  if (cost.currency === tripCurrency) return cost.amount;
  return cost.converted ?? null;
}

export type TripTotals = {
  transport: number;
  stays: number;
  meals: number;
  extras: number;
  total: number;
  /** The costs paid in another currency without a converted amount: not in the totals */
  unconverted: number;
  /** What was billed on to a customer, in the trip's currency */
  billed: number;
};

/** What the trip cost, per kind, in the trip's currency. */
export function tripTotals(state: TripState): TripTotals {
  let unconverted = 0;
  let billed = 0;
  const sum = (items: { cost?: TripCost | null; invoice?: unknown }[]) =>
    round2(
      items.reduce((s, x) => {
        const v = inTripCurrency(x.cost, state.currency);
        if (x.cost && v === null) unconverted++;
        if (v !== null && x.invoice) billed += v;
        return s + (v ?? 0);
      }, 0),
    );
  const transport = sum(state.transport);
  const stays = sum(state.stays);
  const meals = sum(state.meals);
  const extras = sum(state.extras);
  return {
    transport,
    stays,
    meals,
    extras,
    total: round2(transport + stays + meals + extras),
    unconverted,
    billed: round2(billed),
  };
}

const DAY = 86_400_000;
const dayOf = (d: string) => Date.parse(d.slice(0, 10) + "T00:00:00Z");

/** The days away, the first and the last included; none without both dates. */
export function tripDays(
  state: Pick<TripState, "startDate" | "endDate">,
): number | null {
  if (!state.startDate || !state.endDate) return null;
  return Math.round((dayOf(state.endDate) - dayOf(state.startDate)) / DAY) + 1;
}

/** The nights booked: each stay from check-in to check-out. */
export function stayNights(
  stay: Pick<TripStay, "checkIn" | "checkOut">,
): number | null {
  if (!stay.checkIn || !stay.checkOut) return null;
  return Math.max(
    0,
    Math.round((dayOf(stay.checkOut) - dayOf(stay.checkIn)) / DAY),
  );
}

export function tripNights(state: TripState): number {
  return state.stays.reduce((n, s) => n + (stayNights(s) ?? 0), 0);
}

export type ItineraryEntry =
  | { kind: "transport"; at: string | null; item: TripTransport }
  | { kind: "stay"; at: string | null; item: TripStay }
  | { kind: "meal"; at: string | null; item: TripMeal }
  | { kind: "extra"; at: string | null; item: TripExtra };

/**
 * Everything on the trip in the order it happens: legs by departure, stays by
 * check-in, meals and extras by their time. What has no time goes last, in
 * the order it was added.
 */
export function itinerary(state: TripState): ItineraryEntry[] {
  const entries: ItineraryEntry[] = [
    ...state.transport.map((item) => ({
      kind: "transport" as const,
      at: item.departAt ?? item.arriveAt ?? null,
      item,
    })),
    ...state.stays.map((item) => ({
      kind: "stay" as const,
      at: item.checkIn ?? null,
      item,
    })),
    ...state.meals.map((item) => ({
      kind: "meal" as const,
      at: item.at ?? null,
      item,
    })),
    ...state.extras.map((item) => ({
      kind: "extra" as const,
      at: item.at ?? null,
      item,
    })),
  ];
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      if (a.e.at && b.e.at) return a.e.at.localeCompare(b.e.at) || a.i - b.i;
      if (a.e.at) return -1;
      if (b.e.at) return 1;
      return a.i - b.i;
    })
    .map(({ e }) => e);
}

/** "Copenhagen, Lisbon": the places the trip goes, in order. */
export function destinationLine(
  state: Pick<TripState, "destinations">,
): string {
  return state.destinations.map((d) => d.city).join(", ");
}
