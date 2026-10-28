// How far an Original Source Queue has walked, as pure functions over its
// state: the Backfills workspace shows them, and the integration reconciler
// (which runs where nothing browser-side can be imported) reads them too.
import type { OriginalSourceQueueDocument } from "document-models/original-source-queue";

export type QueueState = OriginalSourceQueueDocument["state"]["global"];

/** How many positions the whole space has: the product of the loops. */
export function totalOf(state: QueueState): number {
  if (state.cursors.length === 0) return 0;
  return state.cursors.reduce((product, cursor) => product * cursor.count, 1);
}

/**
 * Where the walk is, counting from one. progress is index/total, so the
 * ordinal comes back out of it rather than being recomputed: one definition
 * of where we are, not two.
 */
export function iterationOf(state: QueueState): number {
  const total = totalOf(state);
  if (total === 0) return 0;
  if (state.status === "FINISHED") return total;
  return Math.min(total, Math.round(state.progress * total) + 1);
}

export type QueueProgress = {
  /** Slices walked */
  done: number;
  total: number;
  finished: boolean;
};

/**
 * How far a queue has walked. The for-every trigger moves the cursor before
 * each run, so the slice in hand is not done yet: done counts the ones
 * before it.
 */
export function queueProgress(state: QueueState): QueueProgress {
  const total = totalOf(state);
  if (state.status === "FINISHED")
    return { done: total, total, finished: true };
  if (state.status === "DRAFT") return { done: 0, total, finished: false };
  return { done: Math.max(0, iterationOf(state) - 1), total, finished: false };
}
