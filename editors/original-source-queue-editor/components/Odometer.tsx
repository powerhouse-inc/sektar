/**
 * Where the queue has got to.
 *
 * The one question a person has of a running backfill, so it is the one thing
 * at the top of the screen. The cursors sit side by side in nesting order —
 * outermost first — because that is how they actually turn: the rightmost
 * moves every iteration, the leftmost once per full sweep of everything to
 * its right.
 */
import type {
  OsqCollection,
  OsqCursor,
} from "document-models/original-source-queue";
import {
  cursorLabel,
  isDateTimeCursor,
} from "document-models/original-source-queue";
import { CARD, readingOf } from "./lib.js";

export function Odometer({
  cursors,
  collections,
  awaitingValues,
  status,
}: {
  cursors: OsqCursor[];
  collections: OsqCollection[];
  awaitingValues: boolean;
  status: string;
}) {
  const values: Record<string, unknown[]> = {};
  for (const collection of collections) {
    values[collection.id] = collection.values;
  }

  if (cursors.length === 0) {
    return (
      <section className={CARD}>
        <p className="text-sm text-muted-foreground">
          No cursors yet. Add one below to describe the space to walk.
        </p>
      </section>
    );
  }

  return (
    <section className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Position</h2>
        <span className="text-xs text-muted-foreground">
          outermost loop first
        </span>
      </div>

      {awaitingValues && (
        // Not an error and not the end: the distinction the whole
        // discover-then-drain pattern rests on.
        <p className="mt-2 rounded-md border border-border bg-background p-2 text-xs text-muted-foreground">
          Waiting for values. A queue this walk depends on is empty, so there
          is nothing to hand out yet — it carries on as soon as something is
          pushed onto it.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {cursors.map((cursor, depth) => {
          const reading = readingOf(cursor, values);
          const of = cursor.count > 0 ? cursor.count : 0;
          const at = cursor.count > 0 ? cursor.position + 1 : 0;
          return (
            <div
              key={cursor.id}
              className="min-w-40 flex-1 rounded-md border border-border p-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-foreground">
                  {cursorLabel(cursor)}
                </span>
                <span className="text-[0.65rem] text-muted-foreground">
                  depth {depth + 1}
                </span>
              </div>

              <p className="mt-1 truncate text-base font-semibold tabular-nums text-foreground">
                {reading.current}
              </p>

              {/* For a time cursor the pair IS the query range, so it reads
                  as one rather than as "the value after this one". */}
              {reading.next !== null && (
                <p className="truncate text-[0.7rem] text-muted-foreground">
                  {isDateTimeCursor(cursor) ? "until " : "next "}
                  {reading.next}
                </p>
              )}

              <p className="mt-1 text-[0.7rem] tabular-nums text-muted-foreground">
                {status === "DRAFT"
                  ? `${String(of)} to walk`
                  : `${String(at)} of ${String(of)}`}
                {cursor.finished && status !== "DRAFT" ? " · last" : ""}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
