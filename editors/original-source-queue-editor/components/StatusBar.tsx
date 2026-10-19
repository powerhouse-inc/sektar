/**
 * Status, progress, and the controls that move between them.
 *
 * Only the transitions the document will actually accept are enabled: the
 * reducers refuse the rest by name, and a button certain to produce an error
 * is worse than no button. Each disabled control keeps its tooltip, so the
 * reason is readable rather than merely enforced.
 */
import type { OriginalSourceQueueAction } from "document-models/original-source-queue";
import { actions } from "document-models/original-source-queue";
import { BTN, BTN_PRIMARY, CARD } from "./lib.js";

const TONE: Record<string, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  IN_PROGRESS: "bg-blue-600 text-white",
  PAUSED: "bg-amber-500 text-white",
  FINISHED: "bg-green-600 text-white",
};

export function StatusBar({
  status,
  progress,
  total,
  cursorCount,
  dispatch,
}: {
  status: string;
  progress: number;
  total: number;
  cursorCount: number;
  dispatch: (action: OriginalSourceQueueAction) => void;
}) {
  const pct = progress * 100;
  // A long backfill spends its first dozen iterations rounding to zero, which
  // reads as "nothing is happening" on a queue that is working fine.
  const shown = pct > 0 && pct < 1 ? pct.toFixed(1) : String(Math.round(pct));
  // progress is index/total, so the ordinal comes back out of it rather than
  // being recomputed here — one definition of where we are, not two.
  const ordinal = Math.round(progress * total) + 1;
  const walking = status === "IN_PROGRESS" || status === "PAUSED";

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[status] ?? TONE.DRAFT}`}
          >
            {status.replace("_", " ").toLowerCase()}
          </span>
          <span className="text-sm tabular-nums text-foreground">
            {status === "DRAFT"
              ? `${String(total)} iteration${total === 1 ? "" : "s"}`
              : walking
                ? `${String(ordinal)} of ${String(total)}`
                : `${String(total)} of ${String(total)}`}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {status === "DRAFT" ? "to walk" : `${shown}%`}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={status !== "DRAFT" || cursorCount === 0}
            title={
              cursorCount === 0
                ? "Add at least one cursor first: a queue with no cursors describes no loop."
                : "Begin the walk and hand out the first tuple."
            }
            onClick={() => {
              dispatch(actions.start({}));
            }}
          >
            Start
          </button>
          <button
            type="button"
            className={BTN}
            disabled={status !== "IN_PROGRESS"}
            title="Advance one tuple by hand."
            onClick={() => {
              dispatch(actions.proceed({}));
            }}
          >
            Proceed
          </button>
          <button
            type="button"
            className={BTN}
            disabled={status !== "IN_PROGRESS"}
            onClick={() => {
              dispatch(actions.pause({}));
            }}
          >
            Pause
          </button>
          <button
            type="button"
            className={BTN}
            disabled={status !== "PAUSED"}
            onClick={() => {
              dispatch(actions.unpause({}));
            }}
          >
            Resume
          </button>
          <button
            type="button"
            className={BTN}
            disabled={status === "FINISHED"}
            title="Stop for good without walking the rest."
            onClick={() => {
              dispatch(actions.terminate({}));
            }}
          >
            Terminate
          </button>
          <button
            type="button"
            className={BTN}
            disabled={status === "DRAFT"}
            title="Back to a draft. Cursors and queued values stay; position, errors and memory are cleared."
            onClick={() => {
              dispatch(actions.reset({}));
            }}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-blue-600 transition-[width]"
          style={{ width: `${String(pct)}%` }}
        />
      </div>
    </section>
  );
}
