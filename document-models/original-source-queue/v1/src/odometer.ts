/**
 * The counter at the centre of the queue.
 *
 * Nested loops as an odometer: the deepest cursor advances first, and when it
 * overflows it resets and carries to the one above it. That is the whole idea,
 * and everything difficult here is an edge of it.
 *
 * This module is deliberately free of the generated document types. It speaks
 * in the three shapes below, so the arithmetic can be tested against a plain
 * nested `for` loop without a document, a reducer, or a reactor in the way.
 * The reducers adapt the generated union onto these — the generated cursors
 * carry no `__typename`, so they are told apart by their unique field
 * (`step`, `deltaSeconds`, `collection`).
 *
 * Two rules in here are judgement rather than arithmetic, and both are load
 * bearing. They are marked WHY at the point they are applied.
 */

/**
 * A number cursor iterates POINTS: first, first±step, … up to last.
 *
 * `first` and `last` decide the direction of travel — `52 → 1` counts down.
 * `step` is therefore a magnitude and must be positive; a signed step would
 * give two ways to say the same thing and one way to contradict it.
 */
export interface NumberSpec {
  kind: "number";
  first: number;
  last: number;
  step: number;
}

/**
 * A datetime cursor iterates INTERVALS, not points.
 *
 * `[current, next)` is a gap-free, non-overlapping cover of `[first, last]`,
 * which is exactly the `after:`/`before:` pair an API query wants. Points
 * would leave the tail after the final point uncovered and would give the last
 * iteration no `next` to close its range against — the single most useful
 * thing this cursor produces.
 *
 * Direction of travel comes from `first` and `last`, and counting down is the
 * common case for a backfill: newest week first. It reverses the ORDER the
 * intervals are visited in, never the orientation of an interval — `current`
 * is always the earlier bound and `next` the later one, so `[current, next)`
 * stays a valid range whichever way the queue is walking.
 */
export interface DateTimeSpec {
  kind: "datetime";
  first: string;
  last: string;
  deltaSeconds: number;
}

/** A collection cursor iterates INDICES into a live queue. */
export interface CollectionSpec {
  kind: "collection";
  /** The queue's length right now; it moves as values are pushed or cleared. */
  length: number;
}

export type CursorSpec = NumberSpec | DateTimeSpec | CollectionSpec;

/**
 * Where the machine is.
 *
 * `entered` is what stops a park from eating an iteration. While it is false,
 * `positions` is where the machine WANTS to be and has not yet handed out; the
 * next successful step realises it rather than incrementing past it.
 */
export interface Odometer {
  positions: number[];
  entered: boolean;
}

export type Outcome =
  /** `positions` is a real tuple; do the work. */
  | "RUNNING"
  /** Nothing to hand out right now, but there may be later. Not finished. */
  | "PARKED"
  /** The space is fully walked. Terminal. */
  | "EXHAUSTED";

export interface StepResult {
  odometer: Odometer;
  outcome: Outcome;
}

const MS = 1000;

/** How many iterations a cursor contributes. Zero is a legitimate answer. */
export function countOf(spec: CursorSpec): number {
  switch (spec.kind) {
    case "number": {
      // A non-positive step would never terminate; treated as empty here and
      // rejected outright when the cursor is created.
      if (spec.step <= 0) return 0;
      // Distance, not difference: `52 → 1` is as long a walk as `1 → 52`.
      // `first === last` is one point, not none.
      return Math.floor(Math.abs(spec.last - spec.first) / spec.step) + 1;
    }
    case "datetime": {
      if (spec.deltaSeconds <= 0) return 0;
      const from = Date.parse(spec.first);
      const to = Date.parse(spec.last);
      if (Number.isNaN(from) || Number.isNaN(to)) return 0;
      // Intervals covering the span, the last one clipped. Unlike points, a
      // zero-width span covers nothing: there is no interval to hand out.
      const span = Math.abs(to - from);
      if (span === 0) return 0;
      return Math.ceil(span / (spec.deltaSeconds * MS));
    }
    case "collection":
      return spec.length > 0 ? spec.length : 0;
  }
}

/** The total number of tuples: the product of the counts. */
export function totalCount(specs: CursorSpec[]): number {
  if (specs.length === 0) return 0;
  return specs.reduce((total, spec) => total * countOf(spec), 1);
}

export interface CursorValue {
  current: string | number | null;
  next: string | number | null;
}

/** What a cursor reads at a position. Out of range reads as nothing. */
export function valueAt(spec: CursorSpec, index: number): CursorValue {
  const count = countOf(spec);
  if (index < 0 || index >= count) return { current: null, next: null };

  switch (spec.kind) {
    case "number": {
      // Points, so travelling down simply yields a descending sequence and
      // `next` is the following value in travel order — below `current`.
      const direction = spec.last >= spec.first ? 1 : -1;
      const at = (i: number) => spec.first + i * spec.step * direction;
      return { current: at(index), next: index + 1 < count ? at(index + 1) : null };
    }
    case "datetime": {
      const from = Date.parse(spec.first);
      const to = Date.parse(spec.last);
      const low = Math.min(from, to);
      const high = Math.max(from, to);
      const width = spec.deltaSeconds * MS;
      // Intervals are always laid out forwards in time; walking down visits
      // them back to front, so each one keeps `current < next` and stays a
      // usable range.
      const slot = from > to ? count - 1 - index : index;
      const start = low + slot * width;
      // Clipped, so the final interval ends exactly at the later bound and the
      // cover has no gap and no overhang. Every interval therefore has a `next`.
      const end = Math.min(low + (slot + 1) * width, high);
      return {
        current: new Date(start).toISOString(),
        next: new Date(end).toISOString(),
      };
    }
    case "collection":
      return { current: index, next: index + 1 < count ? index + 1 : null };
  }
}

/** A queue that is empty is empty *yet*; a static range that is empty never fills. */
function isQueue(spec: CursorSpec): boolean {
  return spec.kind === "collection";
}

/** The machine before it has handed out anything. */
export function initial(specs: CursorSpec[]): Odometer {
  return { positions: specs.map(() => 0), entered: false };
}

/**
 * Advance one tuple.
 *
 * Pure: it reads the specs and the current position and returns the next
 * position. Whether that becomes a document state is the reducer's business.
 */
export function step(specs: CursorSpec[], odometer: Odometer): StepResult {
  // Nothing to iterate over is not a loop. Zero cursors is zero tuples, not
  // one empty tuple, so a queue with no cursors finishes the moment it starts.
  if (specs.length === 0) {
    return { odometer: { ...odometer, entered: false }, outcome: "EXHAUSTED" };
  }

  const counts = specs.map(countOf);

  // WHY (1): a static cursor with no values empties the whole product, and
  // its bounds cannot change while running — so this is genuinely finished
  // rather than waiting, unlike a queue. Reversed bounds no longer cause this
  // (they count down); what does is a zero-width time span or a step of zero.
  const staticlyEmpty = specs.some(
    (spec, i) => !isQueue(spec) && counts[i] === 0,
  );
  if (staticlyEmpty) {
    return { odometer: { ...odometer, entered: false }, outcome: "EXHAUSTED" };
  }

  // WHY (2): an empty QUEUE parks instead of finishing. This is the
  // discovery-then-drain shape — one flow pushes work, the loop consumes it —
  // and finishing here would deadlock it, because values can only be added
  // while IN_PROGRESS and a finished queue can never be added to. Positions
  // are left untouched so nothing is skipped when values do arrive.
  const queueEmpty = specs.some((spec, i) => isQueue(spec) && counts[i] === 0);
  if (queueEmpty) {
    return { odometer: { ...odometer, entered: false }, outcome: "PARKED" };
  }

  // Not yet handed out: realise where we already are rather than moving on.
  if (!odometer.entered) {
    const positions = clampIntoRange(odometer.positions, counts);
    return { odometer: { positions, entered: true }, outcome: "RUNNING" };
  }

  const positions = [...odometer.positions];
  for (let k = positions.length - 1; k >= 0; k--) {
    positions[k] = (positions[k] ?? 0) + 1;
    if (positions[k] < counts[k]) {
      // Carried cleanly. Everything deeper starts over — this is what makes
      // it a foreach rather than a diagonal walk.
      for (let deeper = k + 1; deeper < positions.length; deeper++) {
        positions[deeper] = 0;
      }
      return { odometer: { positions, entered: true }, outcome: "RUNNING" };
    }
    // Overflowed: reset this wheel and let the one above it move.
    positions[k] = 0;
  }

  // The root overflowed, so the space is walked.
  return {
    odometer: { positions: specs.map(() => 0), entered: false },
    outcome: "EXHAUSTED",
  };
}

/**
 * Pull a remembered position back inside the current counts.
 *
 * A queue can shrink under a parked machine (CLEAR_COLLECTION, or values
 * removed), leaving a position past the end. Landing on the nearest valid
 * index is better than either skipping the level or reading nothing.
 */
function clampIntoRange(positions: number[], counts: number[]): number[] {
  return positions.map((position, i) => {
    const count = counts[i] ?? 0;
    if (count === 0) return 0;
    return Math.min(Math.max(position, 0), count - 1);
  });
}

/**
 * How far along, as a fraction.
 *
 * Mixed radix: the position is read like a number whose digits each have their
 * own base. With a growing queue both the position and the total move, so this
 * is a live estimate and not a promise — which is the honest answer for a
 * space whose size is still being discovered.
 */
export function progressOf(specs: CursorSpec[], odometer: Odometer): number {
  const total = totalCount(specs);
  if (total <= 0) return 0;
  if (!odometer.entered) return 0;
  const index = positionIndex(specs, odometer.positions);
  return Math.min(1, Math.max(0, index / total));
}

/** The tuple's ordinal among all tuples, counting from zero. */
export function positionIndex(
  specs: CursorSpec[],
  positions: number[],
): number {
  let index = 0;
  for (let k = 0; k < specs.length; k++) {
    const count = countOf(specs[k]);
    index = index * count + Math.min(positions[k] ?? 0, Math.max(count - 1, 0));
  }
  return index;
}
