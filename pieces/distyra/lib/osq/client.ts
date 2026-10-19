/**
 * Talking to an Original Source Queue from a workflow step.
 *
 * Unlike the rest of this piece, these steps touch the reactor rather than
 * the Distyra API: a queue's position lives in a document, and a trigger that
 * advances it has to write there itself. The framework hands every step a
 * `ReactorService` for exactly this.
 *
 * The shape returned by `shapeOf` is the whole ergonomic argument for the
 * queue. A flow should be able to write `{{trigger.payload.values.week}}` or
 * `{{trigger.payload.ranges.week.from}}` and get on with it, rather than indexing
 * into a cursor array and knowing which slot is which.
 */
import {
  Property,
  type ReactorClient,
  type ReactorReadClient,
} from "@powerhousedao/pieces-framework";

export const OSQ_TYPE = "distyra/original-source-queue";

/**
 * A plain, global-scoped action for the reactor client's `execute`. The host
 * signs every action it runs, so a worker-side id and timestamp are fine here:
 * this is piece code, not a reducer, and nothing deterministic depends on them.
 */
function toGlobalAction(action: { type: string; input?: unknown }) {
  return {
    id: crypto.randomUUID(),
    timestampUtcMs: new Date().toISOString(),
    type: action.type,
    input: action.input,
    scope: "global",
  };
}

/** A cursor as it comes back from the reactor. Kinds differ by their fields. */
interface RawCursor {
  id: string;
  name?: string | null;
  position: number;
  count: number;
  finished: boolean;
  current?: unknown;
  next?: unknown;
  step?: number;
  deltaSeconds?: number;
  collection?: string;
}

interface RawCollection {
  id: string;
  name: string;
  values: unknown[];
}

export interface QueueState {
  description?: string | null;
  status: string;
  progress: number;
  awaitingValues: boolean;
  cursors: RawCursor[];
  collections: RawCollection[];
  memory: { key: string; value: unknown }[];
  errors: { id: string; message: string }[];
}

/** A name a flow can write in an expression: lowercase, no punctuation. */
export function slugOf(cursor: RawCursor, index: number): string {
  const base = (cursor.name ?? "").trim().toLowerCase();
  const slug = base.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return slug === "" ? `cursor_${String(index + 1)}` : slug;
}

function kindOf(cursor: RawCursor): "number" | "datetime" | "collection" {
  if (cursor.step !== undefined) return "number";
  if (cursor.deltaSeconds !== undefined) return "datetime";
  return "collection";
}

/**
 * What a cursor is worth to a flow.
 *
 * A collection cursor's `current` is an index, which is the machine's
 * business; the flow wants the value that index points at.
 */
function valueOf(cursor: RawCursor, collections: RawCollection[]): unknown {
  if (kindOf(cursor) !== "collection") return cursor.current ?? null;
  if (typeof cursor.current !== "number") return null;
  const queue = collections.find((c) => c.id === cursor.collection);
  return queue?.values[cursor.current] ?? null;
}

function nextValueOf(cursor: RawCursor, collections: RawCollection[]): unknown {
  if (kindOf(cursor) !== "collection") return cursor.next ?? null;
  if (typeof cursor.next !== "number") return null;
  const queue = collections.find((c) => c.id === cursor.collection);
  return queue?.values[cursor.next] ?? null;
}

export interface QueueShape {
  documentId: string;
  status: string;
  progress: number;
  awaitingValues: boolean;
  /** Where the walk is, counting from one, and how far it has to go. */
  iteration: number;
  total: number;
  cursors: {
    id: string;
    name: string;
    kind: string;
    value: unknown;
    next: unknown;
    position: number;
    count: number;
    finished: boolean;
  }[];
  /** Cursor value by slug — the form a flow expression wants. */
  values: Record<string, unknown>;
  /**
   * Time cursors as ready-made ranges. `from`/`to` is the half-open window
   * the cursor covers, which drops straight into an after/before query.
   */
  ranges: Record<string, { from: unknown; to: unknown }>;
  memory: Record<string, unknown>;
}

export function shapeOf(documentId: string, state: QueueState): QueueShape {
  const total = state.cursors.reduce(
    (product, cursor) => product * cursor.count,
    state.cursors.length === 0 ? 0 : 1,
  );

  const values: Record<string, unknown> = {};
  const ranges: Record<string, { from: unknown; to: unknown }> = {};
  const cursors = state.cursors.map((cursor, index) => {
    const slug = slugOf(cursor, index);
    const value = valueOf(cursor, state.collections);
    const next = nextValueOf(cursor, state.collections);
    values[slug] = value;
    if (kindOf(cursor) === "datetime") ranges[slug] = { from: value, to: next };
    return {
      id: cursor.id,
      name: cursor.name ?? slug,
      kind: kindOf(cursor),
      value,
      next,
      position: cursor.position,
      count: cursor.count,
      finished: cursor.finished,
    };
  });

  const memory: Record<string, unknown> = {};
  for (const entry of state.memory) memory[entry.key] = entry.value;

  return {
    documentId,
    status: state.status,
    progress: state.progress,
    awaitingValues: state.awaitingValues,
    // progress is index/total, so the ordinal comes back out of it rather
    // than being recomputed from the positions.
    iteration: total > 0 ? Math.round(state.progress * total) + 1 : 0,
    total,
    cursors,
    values,
    ranges,
    memory,
  };
}

/** Read a queue's state, failing loudly if the document is not one. */
export async function readQueue(
  ctx: { reactor: ReactorReadClient },
  documentId: string,
): Promise<QueueState> {
  const summary = await ctx.reactor.get(documentId);
  if (summary.header.documentType !== OSQ_TYPE) {
    throw new Error(
      `Document ${documentId} is a ${summary.header.documentType}, not an Original Source Queue.`,
    );
  }
  return stateOf(summary.state);
}

/**
 * Unwrap the state the reactor returns.
 *
 * It arrives as `unknown` and may or may not be wrapped in its scope, so both
 * shapes are accepted rather than assuming one and failing obscurely.
 */
export function stateOf(raw: unknown): QueueState {
  const outer = raw as { global?: unknown } | null;
  const inner = outer && typeof outer === "object" && "global" in outer
    ? outer.global
    : raw;
  const state = inner as Partial<QueueState> | null;
  if (!state || typeof state !== "object" || !Array.isArray(state.cursors)) {
    throw new Error("That document did not come back with a queue state.");
  }
  return {
    description: state.description ?? null,
    status: state.status ?? "DRAFT",
    progress: state.progress ?? 0,
    awaitingValues: state.awaitingValues ?? false,
    cursors: state.cursors,
    collections: state.collections ?? [],
    memory: state.memory ?? [],
    errors: state.errors ?? [],
  };
}

/** Apply actions and return the state as it is AFTERWARDS. */
export async function applyToQueue(
  ctx: { reactor: ReactorClient },
  documentId: string,
  actions: { type: string; input?: unknown }[],
): Promise<QueueState> {
  const after = await ctx.reactor.execute(
    documentId,
    "main",
    actions.map(toGlobalAction),
  );
  // `execute` returns the updated document, which is what lets the trigger
  // advance and decide whether to fire in a single round trip.
  return stateOf(after.state);
}

/**
 * Picks the queue a step works against.
 *
 * Listed from the reactor rather than typed by hand: a document id is not
 * something a person should have to copy, and the status is worth seeing at
 * selection time because it decides whether the step will do anything.
 */
export const osqDocumentProp = Property.Dropdown<string, true>({
  displayName: "Queue",
  // No auth: these steps reach the reactor, not Distyra, so requiring a bank
  // connection to pick a queue would misstate what the step needs.
  auth: undefined,
  description:
    "The Original Source Queue this step reads or advances. Its status decides what happens: a draft is started, a walk in progress is advanced, anything else is left alone.",
  required: true,
  refreshers: [],
  options: async (_propsValue, ctx) => {
    if (!ctx.reactor) {
      return {
        disabled: true,
        placeholder: "Reactor access is not available here",
        options: [],
      };
    }
    try {
      const page = await ctx.reactor.find({ type: OSQ_TYPE }, undefined, {
        cursor: "",
        limit: 200,
      });
      const found = page.results;
      if (found.length === 0) {
        return {
          disabled: true,
          placeholder: "No Original Source Queue documents on this reactor yet",
          options: [],
        };
      }
      return {
        options: found.map((document) => {
          let suffix = "";
          try {
            const state = stateOf(document.state);
            suffix = ` — ${state.status.replace("_", " ").toLowerCase()}`;
          } catch {
            // A document with unreadable state is still selectable; the step
            // itself will say what is wrong with it far more clearly than a
            // dropdown can.
          }
          return {
            label: `${document.header.name}${suffix}`,
            value: document.header.id,
          };
        }),
      };
    } catch (error) {
      return {
        disabled: true,
        placeholder:
          error instanceof Error
            ? `Could not list queues: ${error.message}`
            : "Could not list queues",
        options: [],
      };
    }
  },
});

/**
 * Whether a state is one a flow should actually do work on.
 *
 * Both halves are load bearing. `IN_PROGRESS` alone is not enough: the final
 * advance transitions to FINISHED, and checking status only before moving
 * would hand out one phantom position past the end. And a parked queue is in
 * progress with nothing to give, so `awaitingValues` has to be excluded too
 * or the flow runs on a tuple of nulls.
 */
export function hasWorkToDo(state: QueueState): boolean {
  return state.status === "IN_PROGRESS" && !state.awaitingValues;
}
