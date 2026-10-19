/**
 * The bridge between the document's cursors and the pure odometer.
 *
 * Everything derivable is derived here and nowhere else, so there is exactly
 * one place that decides what `current`, `next`, `finished`, `count`,
 * `progress`, `status` and `awaitingValues` are. A reducer's job is to change
 * an input and then ask for a recalculation; none of them does arithmetic of
 * its own. That is the point of the model — a workflow author, and the
 * reducers themselves, are never trusted to work out what comes next.
 *
 * The generated union carries no `__typename`, so cursors are told apart by
 * the field only that kind has: `step`, `deltaSeconds`, `collection`.
 */
import type {
  OriginalSourceQueueState,
  OsqCursor,
  OsqCursorValue,
} from "../gen/schema/types.js";
import {
  isCollectionCursor,
  isDateTimeCursor,
  isNumberCursor,
} from "./utils.js";
import {
  countOf,
  progressOf,
  step as stepOdometer,
  valueAt,
  type CursorSpec,
  type Odometer,
  type Outcome,
} from "./odometer.js";

/** How long the queue a cursor walks is right now. Missing reads as empty. */
function lengthOfCollection(
  state: OriginalSourceQueueState,
  collectionId: string,
): number {
  const collection = state.collections.find((c) => c.id === collectionId);
  return collection ? collection.values.length : 0;
}

/** The document's cursors, as the odometer understands them. */
export function specsOf(state: OriginalSourceQueueState): CursorSpec[] {
  return state.cursors.map((cursor) => toSpec(state, cursor));
}

export function toSpec(
  state: OriginalSourceQueueState,
  cursor: OsqCursor,
): CursorSpec {
  if (isNumberCursor(cursor)) {
    return {
      kind: "number",
      first: cursor.first,
      last: cursor.last,
      step: cursor.step,
    };
  }
  if (isDateTimeCursor(cursor)) {
    return {
      kind: "datetime",
      first: cursor.first,
      last: cursor.last,
      deltaSeconds: cursor.deltaSeconds,
    };
  }
  return {
    kind: "collection",
    length: lengthOfCollection(state, cursor.collection),
  };
}

/**
 * The machine's position, read off the document.
 *
 * `awaitingValues` is the stored form of the odometer's `entered` flag,
 * inverted: a walk that is waiting has not handed out the tuple it is sitting
 * on. Storing it as "waiting" rather than "entered" is deliberate — it is the
 * question a person actually asks of a stalled queue.
 */
export function odometerOf(state: OriginalSourceQueueState): Odometer {
  return {
    positions: state.cursors.map((cursor) => cursor.position),
    entered: state.status === "IN_PROGRESS" && !state.awaitingValues,
  };
}

/**
 * Write a position back onto the document and recompute everything derived.
 *
 * Mutating rather than returning: reducers run inside Mutative, so this is
 * applied to the draft state directly.
 */
export function applyOdometer(
  state: OriginalSourceQueueState,
  odometer: Odometer,
  outcome: Outcome,
): void {
  const specs = specsOf(state);

  if (outcome === "EXHAUSTED") {
    state.status = "FINISHED";
    state.awaitingValues = false;
    state.progress = 1;
    state.cursors.forEach((cursor, i) => {
      cursor.position = 0;
      cursor.count = countOf(specs[i]);
      // Nothing is current once the space is walked; a stale reading here
      // would let a workflow keep working a tuple that is no longer live.
      cursor.current = null;
      cursor.next = null;
      cursor.finished = true;
    });
    return;
  }

  const running = outcome === "RUNNING";
  state.awaitingValues = !running;
  state.cursors.forEach((cursor, i) => {
    const spec = specs[i];
    const count = countOf(spec);
    const position = odometer.positions[i] ?? 0;
    cursor.position = position;
    cursor.count = count;

    if (!running) {
      // Parked: there is no tuple to hand out, so there is no reading.
      cursor.current = null;
      cursor.next = null;
      cursor.finished = false;
      return;
    }

    const reading = valueAt(spec, position);
    writeReading(cursor, reading.current, reading.next);
    // "Sitting on the last value", not "past the end" — the machine never
    // rests past the end, it finishes instead.
    cursor.finished = count === 0 || position >= count - 1;
  });

  state.progress = running
    ? progressOf(specs, { positions: odometer.positions, entered: true })
    : state.progress;
}

/**
 * Put a reading onto a cursor.
 *
 * The union's members type `current`/`next` differently — a datetime cursor
 * reads instants, the other two read numbers — so the narrowing that keeps
 * this honest happens once, here.
 */
function writeReading(
  cursor: OsqCursor,
  current: string | number | null,
  next: string | number | null,
): void {
  if (isDateTimeCursor(cursor)) {
    cursor.current = typeof current === "string" ? current : null;
    cursor.next = typeof next === "string" ? next : null;
    return;
  }
  const asNumber = (value: string | number | null) =>
    typeof value === "number" ? value : null;
  if (isNumberCursor(cursor)) {
    cursor.current = asNumber(current);
    cursor.next = asNumber(next);
    return;
  }
  cursor.current = asNumber(current);
  cursor.next = asNumber(next);
}

/**
 * Recompute the derived fields without moving.
 *
 * Needed whenever an input changes under a standing position — a queue grown
 * or cleared — because `count`, `finished` and `progress` are all functions of
 * the queue's length and would otherwise go stale.
 */
export function recalculate(state: OriginalSourceQueueState): void {
  const specs = specsOf(state);

  if (state.status === "DRAFT") {
    state.progress = 0;
    state.awaitingValues = false;
    state.cursors.forEach((cursor, i) => {
      cursor.position = 0;
      cursor.count = countOf(specs[i]);
      cursor.current = null;
      cursor.next = null;
      cursor.finished = false;
    });
    return;
  }

  if (state.status === "FINISHED") {
    state.cursors.forEach((cursor, i) => {
      cursor.count = countOf(specs[i]);
    });
    state.progress = 1;
    state.awaitingValues = false;
    return;
  }

  // Running or paused: keep the position, refresh what depends on the inputs.
  const entered = !state.awaitingValues;
  state.cursors.forEach((cursor, i) => {
    const spec = specs[i];
    const count = countOf(spec);
    cursor.count = count;
    if (!entered) {
      cursor.current = null;
      cursor.next = null;
      cursor.finished = false;
      return;
    }
    const reading = valueAt(spec, cursor.position);
    writeReading(cursor, reading.current, reading.next);
    cursor.finished = count === 0 || cursor.position >= count - 1;
  });

  if (entered) {
    state.progress = progressOf(specs, {
      positions: state.cursors.map((c) => c.position),
      entered: true,
    });
  }
}

/** Advance one tuple and write the result back. */
export function advance(state: OriginalSourceQueueState): Outcome {
  const specs = specsOf(state);
  const result = stepOdometer(specs, odometerOf(state));
  applyOdometer(state, result.odometer, result.outcome);
  return result.outcome;
}

/**
 * The tuple as it stands, for stamping onto an error.
 *
 * Values, not indices: a collection cursor's index means nothing once the
 * queue has been cleared, whereas the value it pointed at still names the work
 * that failed.
 */
export function currentTuple(
  state: OriginalSourceQueueState,
): OsqCursorValue[] {
  return state.cursors.map((cursor) => ({
    cursor: cursor.id,
    value: readValue(state, cursor),
  }));
}

function readValue(
  state: OriginalSourceQueueState,
  cursor: OsqCursor,
): unknown {
  if (isCollectionCursor(cursor)) {
    // `Maybe<T>` is `T | null | undefined`, so a null check alone would leave
    // `undefined` as a possible index.
    if (typeof cursor.current !== "number") return null;
    const collection = state.collections.find(
      (c) => c.id === cursor.collection,
    );
    return collection?.values[cursor.current] ?? null;
  }
  return cursor.current;
}
