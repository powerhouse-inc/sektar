/**
 * Queue Discovered — the step that lets a walk extend itself.
 *
 * Reads a listing, works out which of the things it found are not already
 * queued, and emits the queue actions to record them and move on. Pure: it
 * produces actions for a reactor Dispatch step rather than writing itself.
 */
import { createAction, Property } from "@powerhousedao/pieces-framework";
import { discover, queueActions } from "./discovery.js";

function asList(value: unknown): unknown[] {
  if (value === null || value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function optional(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

/**
 * A listing that was cut short is a subtree silently missing from the walk.
 *
 * Raised rather than reported, because the alternative is a backfill that
 * finishes cleanly having skipped an unknown amount. The queue stays parked
 * on this folder, so narrowing it and re-running resumes exactly here.
 */
class ListingTruncatedError extends Error {
  constructor(where: string) {
    super(
      `The listing of "${where}" was truncated by the provider, so some of its contents were never seen. Walk it in smaller parts, or turn off "Fail when truncated" to accept the gap.`,
    );
    this.name = "ListingTruncatedError";
  }
}

export const distyraOsqQueueDiscoveredAction = createAction({
  name: "osq-queue-discovered",
  requireAuth: false,
  displayName: "Queue Discovered",
  description:
    "Turn a listing into the queue actions that record what it found and advance: pick a field out of each matching record, drop anything already queued, and emit ADD_COLLECTION_VALUE followed by PROCEED. This is how a walk over a tree extends itself — list one folder, queue its subfolders, move on. Feed the output to a reactor Dispatch step aimed at the queue.",
  props: {
    records: Property.Json({
      displayName: "Listing",
      description: "e.g. {{steps.list.output.entries}}.",
      required: true,
    }),
    collection: Property.ShortText({
      displayName: "Collection",
      description:
        "Id of the queue collection to push onto — the one the collection cursor walks.",
      required: true,
    }),
    valuePath: Property.ShortText({
      displayName: "Value field",
      description:
        "What to queue from each record. Dropbox: path_lower, which is what its listing takes as a path.",
      required: true,
    }),
    wherePath: Property.ShortText({
      displayName: "Filter field",
      description: "Optional. Dropbox marks folders with .tag — note the dot.",
      required: false,
    }),
    whereEquals: Property.ShortText({
      displayName: "Filter value",
      description: "Optional, e.g. folder.",
      required: false,
    }),
    existing: Property.Json({
      displayName: "Already queued",
      description:
        "The collection's current values, e.g. {{steps.read.output.state.collections.0.values}}. Without this a folder re-listed after a failed run queues its children again and the walk never ends.",
      required: false,
    }),
    truncated: Property.Checkbox({
      displayName: "Listing was truncated",
      description:
        "e.g. {{steps.list.output.has_more}}. A cut-short listing means part of the tree was never seen.",
      required: false,
      defaultValue: false,
    }),
    failWhenTruncated: Property.Checkbox({
      displayName: "Fail when truncated",
      description:
        "On by default. Off accepts the gap and walks on, which is only reasonable if you know what is being left out.",
      required: false,
      defaultValue: true,
    }),
    proceed: Property.Checkbox({
      displayName: "Advance the queue",
      description:
        "On by default, and sent in the same dispatch as the discoveries so the walk cannot move past a folder without having recorded its contents.",
      required: false,
      defaultValue: true,
    }),
  },
  run(context) {
    const input = context.propsValue;

    if (input.truncated === true && input.failWhenTruncated !== false) {
      throw new ListingTruncatedError(optional(input.valuePath) ?? "a folder");
    }

    const result = discover({
      records: asList(input.records),
      valuePath: input.valuePath.trim(),
      wherePath: optional(input.wherePath),
      whereEquals: optional(input.whereEquals),
      existing: asList(input.existing),
    });

    const dispatchActions = queueActions(
      input.collection.trim(),
      result.values,
      input.proceed !== false,
    );

    return Promise.resolve({
      ...result,
      discovered: result.values.length,
      dispatchActions,
    });
  },
});
