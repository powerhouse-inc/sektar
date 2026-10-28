/**
 * The backfill adapter for Original Source Queues (integrations design
 * §3.2): how the reconciler makes a queue from a date-range backfill item,
 * how far a queue has walked, and how the backfill workflow's trigger points
 * at it. Pure: the reconciler creates and reads documents through its IO.
 */
import {
  actions as osq,
  type OriginalSourceQueueAction,
} from "document-models/original-source-queue";
import type { IntegrationState } from "document-models/integration";
import {
  iterationOf,
  totalOf,
  type QueueState,
} from "../../editors/backfills/progress.js";

export const OSQ_TYPE = "distyra/original-source-queue";
/**
 * The queue's one cursor. The for-every trigger hands its window to the
 * workflow as `ranges.<slug>`, the slug being the lowercased name.
 */
export const SLICE_CURSOR = "Slice";
export const SLICE_RANGE = "slice";

export type BackfillItem =
  IntegrationState["intent"]["backfill"]["items"][number];

type DateRange = {
  from: string;
  to: string;
  stepSeconds: number;
  direction?: "FORWARD" | "BACKWARD" | null;
};

/** The date-range request of an item, or null for another kind (folders) or none. */
export function dateRangeOf(item: BackfillItem): DateRange | null {
  const r = item.request as Partial<DateRange> | null;
  if (!r || typeof r.from !== "string" || typeof r.to !== "string") return null;
  if (typeof r.stepSeconds !== "number") return null;
  return r as DateRange;
}

/**
 * A new queue for an item: its name in the Backfills drive and the actions
 * that give it its cursor. Left a DRAFT: the trigger's first poll starts it.
 * FORWARD walks from the range's start; BACKWARD (and none) from its end.
 */
export function queueSetup(
  integrationName: string,
  item: BackfillItem,
  cursorId: string,
): { name: string; actions: OriginalSourceQueueAction[] } | null {
  const range = dateRangeOf(item);
  if (!range) return null;
  const forward = range.direction === "FORWARD";
  return {
    name: `${integrationName} · ${item.label}`,
    actions: [
      osq.setDescription({
        description: `${item.label}, for the ${integrationName} integration. Sektar keeps it: pausing, resetting or deleting it here changes what comes in.`,
      }),
      osq.createDateTimeCursor({
        id: cursorId,
        name: SLICE_CURSOR,
        first: forward ? range.from : range.to,
        last: forward ? range.to : range.from,
        deltaSeconds: range.stepSeconds,
      }),
    ],
  };
}

export type QueueProgress = {
  /** Slices walked */
  done: number;
  total: number;
  finished: boolean;
};

/**
 * How far a queue has walked. The trigger moves the cursor before each run,
 * so the slice in hand is not done yet: done counts the ones before it.
 */
export function queueProgress(state: QueueState): QueueProgress {
  const total = totalOf(state);
  if (state.status === "FINISHED")
    return { done: total, total, finished: true };
  if (state.status === "DRAFT") return { done: 0, total, finished: false };
  return { done: Math.max(0, iterationOf(state) - 1), total, finished: false };
}

/** The for-every trigger's config for a queue. */
export function forEveryConfig(documentId: string): Record<string, unknown> {
  return { documentId };
}
