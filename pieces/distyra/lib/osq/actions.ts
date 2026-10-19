/**
 * The queue's actions.
 *
 * Reads and writes are deliberately separated. Reading a position or a memory
 * slot writes nothing to the document's history — a flow that reads its own
 * scratchpad every iteration would otherwise leave a permanent no-op
 * operation behind on every tick of a 400-iteration backfill.
 *
 * Every step here sets `requireAuth: false`. The piece's auth is a Distyra
 * bank connection, and these talk to the reactor instead — inheriting it
 * would force someone to attach a bank account before they could advance a
 * cursor over a folder of files.
 */
import {
  createAction,
  Property,
  type ReactorReadClient,
} from "@powerhousedao/pieces-framework";
import {
  applyToQueue,
  osqDocumentProp,
  readQueue,
  shapeOf,
  slugOf,
} from "./client.js";

const errorProps = {
  message: Property.ShortText({
    displayName: "Message",
    description: "What went wrong, in terms that will still mean something when this is read back weeks later.",
    required: true,
  }),
  data: Property.Json({
    displayName: "Details",
    description:
      "Optional structured context — a status code, a response body, whatever makes the failure diagnosable.",
    required: false,
  }),
};

/** Errors need a caller-supplied id: reducers must stay deterministic. */
function errorId(): string {
  return crypto.randomUUID();
}

export const distyraOsqGetCurrentValueAction = createAction({
  name: "osq-get-current-value",
  requireAuth: false,
  requireReactor: "read",
  displayName: "Get Current Value",
  description:
    "Read where a queue is now, without moving it. Returns the cursor values by name, ready-made ranges for time cursors, and the memory slots.",
  props: { documentId: osqDocumentProp },
  async run(context) {
    const documentId = context.propsValue.documentId;
    return shapeOf(documentId, await readQueue(context, documentId));
  },
});

export const distyraOsqGetNextValueAction = createAction({
  name: "osq-get-next-value",
  requireAuth: false,
  requireReactor: "read",
  displayName: "Get Next Value",
  description:
    "Look at the value each cursor will move to next, without moving. Useful for closing a range or deciding whether this is the last iteration.",
  props: { documentId: osqDocumentProp },
  async run(context) {
    const documentId = context.propsValue.documentId;
    const shape = shapeOf(documentId, await readQueue(context, documentId));
    const next: Record<string, unknown> = {};
    for (const cursor of shape.cursors) {
      next[slugOf({ ...cursor, name: cursor.name }, 0)] = cursor.next;
    }
    return {
      documentId,
      // `isLast` is the question a flow actually asks of "next": whether
      // there is anything after this one at all.
      isLast: shape.cursors.every((cursor) => cursor.finished),
      cursors: shape.cursors.map((cursor) => ({
        id: cursor.id,
        name: cursor.name,
        next: cursor.next,
        finished: cursor.finished,
      })),
      values: next,
    };
  },
});

export const distyraOsqReadMemoryAction = createAction({
  name: "osq-read-memory",
  requireAuth: false,
  requireReactor: "read",
  displayName: "Read Memory",
  description:
    "Read the queue's scratchpad — the values a previous iteration left for this one. Reading writes nothing.",
  props: {
    documentId: osqDocumentProp,
    key: Property.ShortText({
      displayName: "Key",
      description: "Leave blank to get every slot.",
      required: false,
    }),
  },
  async run(context) {
    const documentId = context.propsValue.documentId;
    const state = await readQueue(context, documentId);
    const key = context.propsValue.key?.trim();
    if (!key) {
      return { documentId, memory: shapeOf(documentId, state).memory };
    }
    const entry = state.memory.find((slot) => slot.key === key);
    return { documentId, key, value: entry?.value ?? null, found: Boolean(entry) };
  },
});

export const distyraOsqUpdateMemoryAction = createAction({
  name: "osq-update-memory",
  requireAuth: false,
  requireReactor: "write",
  displayName: "Update Memory",
  description:
    "Write a named scratchpad slot that survives into the next iteration. Leaving the value empty removes the slot.",
  props: {
    documentId: osqDocumentProp,
    key: Property.ShortText({ displayName: "Key", required: true }),
    value: Property.Json({
      displayName: "Value",
      description: "Leave empty to clear the slot.",
      required: false,
    }),
  },
  async run(context) {
    const { documentId, key, value } = context.propsValue;
    const after = await applyToQueue(context, documentId, [
      { type: "UPDATE_MEMORY", input: { key, value: value ?? null } },
    ]);
    return { documentId, memory: shapeOf(documentId, after).memory };
  },
});

export const distyraOsqProceedAction = createAction({
  name: "osq-proceed",
  requireAuth: false,
  requireReactor: "write",
  displayName: "Proceed",
  description:
    "Advance the queue one position by hand. Not for use alongside the For Every trigger, which already advances — pairing them would skip every other tuple.",
  props: { documentId: osqDocumentProp },
  async run(context) {
    const documentId = context.propsValue.documentId;
    const after = await applyToQueue(context, documentId, [
      { type: "PROCEED", input: {} },
    ]);
    return shapeOf(documentId, after);
  },
});

export const distyraOsqReportErrorAction = createAction({
  name: "osq-report-error",
  requireAuth: false,
  requireReactor: "write",
  displayName: "Report Error",
  description:
    "Record a failure against the position the queue is on, without advancing. The cursor values are stamped onto it, so the failed slice can be named later rather than guessed at.",
  props: { documentId: osqDocumentProp, ...errorProps },
  async run(context) {
    const { documentId, message, data } = context.propsValue;
    const after = await applyToQueue(context, documentId, [
      {
        type: "REPORT_ERROR",
        input: { id: errorId(), message, data: data ?? null },
      },
    ]);
    return { documentId, errors: after.errors.length };
  },
});

export const distyraOsqProceedWithErrorAction = createAction({
  name: "osq-proceed-with-error",
  requireAuth: false,
  requireReactor: "write",
  displayName: "Proceed With Error",
  description:
    "Record a failure against the current position and then advance past it, so one bad slice does not stall the backfill. Not for use alongside the For Every trigger.",
  props: { documentId: osqDocumentProp, ...errorProps },
  async run(context) {
    const { documentId, message, data } = context.propsValue;
    const after = await applyToQueue(context, documentId, [
      {
        type: "PROCEED_WITH_ERROR",
        input: { id: errorId(), message, data: data ?? null },
      },
    ]);
    return shapeOf(documentId, after);
  },
});

/** Queues are chosen by name here; a flow discovering work knows the name. */
const collectionProp = Property.ShortText({
  displayName: "Queue name",
  description:
    "The name of the collection to act on, as it appears in the document.",
  required: true,
});

/** Resolve a collection by name, since a flow author knows names, not ids. */
async function collectionIdByName(
  ctx: { reactor: ReactorReadClient },
  documentId: string,
  name: string,
): Promise<string> {
  const state = await readQueue(ctx, documentId);
  const wanted = name.trim().toLowerCase();
  const found = state.collections.find(
    (collection) => collection.name.trim().toLowerCase() === wanted,
  );
  if (!found) {
    const known = state.collections.map((c) => c.name).join(", ") || "none";
    throw new Error(
      `This queue has no collection called "${name}". It has: ${known}.`,
    );
  }
  return found.id;
}

export const distyraOsqAddCollectionValuesAction = createAction({
  name: "osq-add-collection-values",
  requireAuth: false,
  requireReactor: "write",
  displayName: "Add Collection Values",
  description:
    "Push work onto a queue while the walk is running. This is how a discovery step feeds the loop that consumes it — a queue waiting on an empty collection resumes on the next advance.",
  props: {
    documentId: osqDocumentProp,
    collection: collectionProp,
    values: Property.Json({
      displayName: "Values",
      description:
        "An array of values to push. A single value is accepted and wrapped.",
      required: true,
    }),
  },
  async run(context) {
    const { documentId, collection, values } = context.propsValue;
    const collectionId = await collectionIdByName(
      context,
      documentId,
      collection,
    );
    // A flow that found exactly one file should not have to remember to wrap
    // it; the operation takes a list either way.
    const list = Array.isArray(values) ? values : [values];
    const after = await applyToQueue(context, documentId, [
      {
        type: "ADD_COLLECTION_VALUE",
        input: { collection: collectionId, values: list },
      },
    ]);
    const queue = after.collections.find((c) => c.id === collectionId);
    return { documentId, collection, queued: queue?.values.length ?? 0 };
  },
});

export const distyraOsqClearCollectionAction = createAction({
  name: "osq-clear-collection",
  requireAuth: false,
  requireReactor: "write",
  displayName: "Clear Collection",
  description:
    "Empty a queue. Any cursor walking it restarts from the top, so values pushed afterwards are treated as new work rather than as work already done.",
  props: { documentId: osqDocumentProp, collection: collectionProp },
  async run(context) {
    const { documentId, collection } = context.propsValue;
    const collectionId = await collectionIdByName(
      context,
      documentId,
      collection,
    );
    await applyToQueue(context, documentId, [
      { type: "CLEAR_COLLECTION", input: { collection: collectionId } },
    ]);
    return { documentId, collection, cleared: true };
  },
});
