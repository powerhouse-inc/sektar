/**
 * ForEvery — one flow run per tuple of a queue.
 *
 * The trigger only reads. It hands the flow the tuple the walk is on (START
 * first, from a draft), and the flow's last step, Proceed with Position set
 * to {{trigger.payload}}, moves the queue once the tuple's work is in. So a
 * run that fails, or is cut off by a stop, leaves the queue where it was, and
 * the next firing works on the same tuple again: nothing is skipped.
 *
 * That needs two things of the workflow, and the trigger enforces both by
 * what it sees: the flow ends with Proceed, and it runs one firing at a time
 * (QUEUE or SINGLETON; the runtime does not poll such a workflow while a
 * firing is unsettled). Then the same tuple only comes round again after a
 * stop or a resumed failure. Handed out more often than that in a row, the
 * flow is not moving the queue, or runs in parallel; the trigger stops firing
 * and says why, rather than looping on one tuple. Switching the workflow off
 * and on again clears the count.
 */
import {
  createTrigger,
  DEDUPE_KEY_PROPERTY,
  TriggerStrategy,
} from "@powerhousedao/pieces-framework";
import {
  applyToQueue,
  hasWorkToDo,
  osqDocumentProp,
  readQueue,
  shapeOf,
  type QueueState,
} from "./client.js";

/** Times in a row one tuple may be handed out before the loop is called stuck. */
export const MAX_HAND_OUTS = 3;

/** Where the trigger counts hand-outs of the tuple it is on (its flow's store). */
const HANDED_OUT = "handed-out";

interface HandedOut {
  tuple: string;
  times: number;
}

interface TriggerStore {
  get<T>(key: string): Promise<T | null>;
  put<T>(key: string, value: T): Promise<T>;
}

/**
 * The tuple as a firing: keyed by the tuple, so a repeat within seconds is
 * dropped, and counted, so a loop that never moves on is caught.
 */
async function handOut(
  store: TriggerStore,
  documentId: string,
  state: QueueState,
) {
  const shape = shapeOf(documentId, state);
  const tuple = `${documentId}:${JSON.stringify(shape.values)}`;
  const last = await store.get<HandedOut>(HANDED_OUT);
  const times = last?.tuple === tuple ? last.times + 1 : 1;
  if (times > MAX_HAND_OUTS) {
    throw new Error(
      `For Every handed out the same position ${MAX_HAND_OUTS} times in a row (${JSON.stringify(shape.values)}), so the flow is not moving the queue. End the flow with Proceed, Position {{trigger.payload}}, and let the workflow run one firing at a time; then switch it off and on again.`,
    );
  }
  await store.put<HandedOut>(HANDED_OUT, { tuple, times });
  return { ...shape, [DEDUPE_KEY_PROPERTY]: tuple };
}

export const distyraForEveryTrigger = createTrigger({
  // Saved workflows refer to the trigger by name: don't rename it once published
  name: "for-every",
  // Reaches the reactor, not Distyra: advancing a cursor involves no bank
  // connection, so requiring one would misstate what this trigger needs.
  requireAuth: false,
  requireReactor: "write",
  displayName: "For Every",
  description:
    "Runs once per position of an Original Source Queue, one at a time. End the flow with Proceed (Position: {{trigger.payload}}): the queue only moves on once a position's steps succeeded, so a failed or interrupted run is worked on again. For a time cursor, `{{trigger.payload.ranges.<name>.from}}` and `.to` are the query window.",
  type: TriggerStrategy.POLLING,
  props: {
    documentId: osqDocumentProp,
  },
  sampleData: {
    documentId: "pe1dLMr8nJN627YMIbPLIzRmJPAqHmw3KKm5PKqJr0s",
    status: "IN_PROGRESS",
    progress: 0.00496,
    awaitingValues: false,
    iteration: 5,
    total: 806,
    cursors: [
      {
        id: "cur-weeks",
        name: "Week",
        kind: "datetime",
        value: "2026-09-07T00:00:00.000Z",
        next: "2026-09-14T00:00:00.000Z",
        position: 2,
        count: 403,
        finished: false,
      },
      {
        id: "cur-label",
        name: "Label",
        kind: "collection",
        value: "INBOX",
        next: "SENT",
        position: 0,
        count: 2,
        finished: false,
      },
    ],
    values: { week: "2026-09-07T00:00:00.000Z", label: "INBOX" },
    ranges: {
      week: {
        from: "2026-09-07T00:00:00.000Z",
        to: "2026-09-14T00:00:00.000Z",
      },
    },
    memory: { pageToken: "08234ab91f" },
  },

  // A fresh start: whatever was counted against the old flow does not hold
  // against the one being switched on.
  onEnable: (context) =>
    context.store.put<HandedOut | null>(HANDED_OUT, null).then(() => undefined),
  onDisable: () => Promise.resolve(),

  async run(context) {
    const documentId = context.propsValue.documentId;
    const before = await readQueue(context, documentId);

    if (before.status === "DRAFT") {
      const after = await applyToQueue(context, documentId, [
        { type: "START", input: {} },
      ]);
      return hasWorkToDo(after)
        ? [await handOut(context.store, documentId, after)]
        : [];
    }

    if (before.status === "IN_PROGRESS" && !before.awaitingValues) {
      return [await handOut(context.store, documentId, before)];
    }

    if (before.status === "IN_PROGRESS") {
      // Parked on an empty collection, nothing is handed out, so this advance
      // takes up a value that arrived since rather than stepping past work.
      const after = await applyToQueue(context, documentId, [
        { type: "PROCEED", input: {} },
      ]);
      return hasWorkToDo(after)
        ? [await handOut(context.store, documentId, after)]
        : [];
    }

    // PAUSED or FINISHED: deliberately silent.
    return [];
  },

  test(context) {
    // A test hands nothing out: it neither moves the queue nor counts.
    const documentId = context.propsValue.documentId;
    return readQueue(context, documentId).then((state) =>
      hasWorkToDo(state) ? [shapeOf(documentId, state)] : [],
    );
  },
});
