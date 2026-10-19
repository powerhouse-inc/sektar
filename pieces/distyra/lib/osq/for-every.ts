/**
 * ForEvery — one flow run per tuple of a queue.
 *
 * Like a schedule trigger, except the thing it hands the flow is a position
 * rather than a time: START from a draft, PROCEED from a walk in progress,
 * and nothing at all otherwise.
 *
 * The ordering matters and is easy to get subtly wrong. The trigger advances
 * FIRST and hands the flow the tuple it lands on, so the document is always
 * parked on the work being done. If the flow crashes halfway, the next tick
 * resumes on the same tuple rather than skipping it.
 */
import { createTrigger, TriggerStrategy } from "@powerhousedao/pieces-framework";
import {
  applyToQueue,
  hasWorkToDo,
  osqDocumentProp,
  readQueue,
  shapeOf,
} from "./client.js";


export const distyraForEveryTrigger = createTrigger({
  // Saved workflows refer to the trigger by name: don't rename it once published
  name: "for-every",
  // Reaches the reactor, not Distyra: advancing a cursor involves no bank
  // connection, so requiring one would misstate what this trigger needs.
  requireAuth: false,
  requireReactor: "write",
  displayName: "For Every",
  description:
    "Runs once per position of an Original Source Queue. Starts a draft, advances a walk in progress, and stays quiet when the queue is paused, finished, or waiting for values. The flow receives the position it should work on — for a time cursor, `{{trigger.payload.ranges.<name>.from}}` and `.to` are the query window.",
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

  // Nothing to set up or tear down: the position lives in the document, not
  // in the trigger, which is the entire point of keeping it there.
  onEnable: () => Promise.resolve(),
  onDisable: () => Promise.resolve(),

  async run(context) {
    const documentId = context.propsValue.documentId;
    const before = await readQueue(context, documentId);

    if (before.status === "DRAFT") {
      const after = await applyToQueue(context, documentId, [
        { type: "START", input: {} },
      ]);
      return hasWorkToDo(after) ? [shapeOf(documentId, after)] : [];
    }

    if (before.status === "IN_PROGRESS") {
      const after = await applyToQueue(context, documentId, [
        { type: "PROCEED", input: {} },
      ]);
      // Checked on the state AFTER the move, which is what closes the
      // phantom-run gap: the advance that finishes the queue must not also
      // start a run.
      return hasWorkToDo(after) ? [shapeOf(documentId, after)] : [];
    }

    // PAUSED or FINISHED: deliberately silent. Advancing either would be
    // refused by the reducers anyway, and firing the flow would be worse.
    return [];
  },

  test(context) {
    // A test must not spend an iteration. Testing a trigger is something a
    // person does repeatedly while building a flow, and a test that advanced
    // the real backfill would quietly eat the first dozen slices of it.
    const documentId = context.propsValue.documentId;
    return readQueue(context, documentId).then((state) =>
      hasWorkToDo(state) ? [shapeOf(documentId, state)] : [],
    );
  },
});
