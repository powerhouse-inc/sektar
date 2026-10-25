/**
 * The trip index: one lean row per trip document.
 *
 * Business Travel lists trips, filters them by phase and year and sums them
 * per year. None of that needs a trip's stays, meals and attachments, so the
 * index keeps what a row shows and what a filter or a sum needs. Rows come
 * off `operation.context.resultingState` (see `rows.ts`); no document is
 * loaded.
 */
export interface TripRow {
  document_id: string;
  title: string | null;
  /** PLANNED | BOOKED | COMPLETED | CANCELLED */
  status: string;
  purpose_kind: string | null;
  /** YYYY-MM-DD */
  start_date: string | null;
  /** YYYY-MM-DD */
  end_date: string | null;
  traveler_name: string | null;
  /** JSON: [{ city, country }] */
  destinations: string;
  /** JSON: { mode, carrier, number, from, to, departAt } | null */
  first_leg: string | null;
  /** Transport legs with mode FLIGHT. */
  flights: number;
  /** Every transport leg, whatever its mode. */
  legs: number;
  /** Sum over stays of (check-out - check-in) in days. */
  nights: number;
  /** The days away, first and last day included; 1 without both dates. */
  days: number;
  /** Every cost in the trip's currency (amount, else converted), where known. */
  cost_total: number;
  /** The part of cost_total that has an invoice link. */
  billed_total: number;
  /** The parts of cost_total, by kind of cost (the same rule as cost_total). */
  cost_transport: number;
  cost_stays: number;
  cost_meals: number;
  cost_extras: number;
  currency: string;
  /** Lower-cased haystack for the word search. */
  search_text: string;
  updated_at: string;
}

export interface DB {
  trip_index: TripRow;
}
