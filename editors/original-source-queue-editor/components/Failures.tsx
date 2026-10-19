/**
 * What went wrong, and exactly where.
 *
 * The coordinates are the point. A list of messages is a log; a list of
 * messages each naming the tuple that produced it is a worklist — it says
 * precisely which slices to go back for once the cause is fixed.
 */
import type {
  OsqCursor,
  OsqError,
} from "document-models/original-source-queue";
import { cursorLabel } from "document-models/original-source-queue";
import { CARD, str } from "./lib.js";

export function Failures({
  errors,
  cursors,
}: {
  errors: OsqError[];
  cursors: OsqCursor[];
}) {
  const nameOf: Record<string, string> = {};
  for (const cursor of cursors) nameOf[cursor.id] = cursorLabel(cursor);

  return (
    <section className={CARD}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Failures</h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {errors.length}
        </span>
      </div>

      {errors.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          None recorded. A slice that fails is reported here with the exact
          cursor values it failed on.
        </p>
      ) : (
        <ul className="mt-2 space-y-1">
          {errors.map((error) => (
            <li
              key={error.id}
              className="rounded-md border border-destructive p-2"
            >
              <p className="text-sm text-foreground">{error.message}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {error.cursors.length === 0
                  ? "no position recorded"
                  : error.cursors
                      .map(
                        (value) =>
                          `${nameOf[value.cursor] ?? value.cursor}: ${str(value.value) || "—"}`,
                      )
                      .join(" · ")}
              </p>
              {error.data !== null && error.data !== undefined && (
                <pre className="mt-1 overflow-x-auto rounded bg-background p-1 text-[0.7rem] text-muted-foreground">
                  {str(error.data)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
