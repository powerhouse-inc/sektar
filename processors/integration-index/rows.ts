// Turns integration, queue and connection states into their index rows.
// Pure, shared by the processor and its tests. The state arrives as the
// operation's `resultingState` (every scope, then the header); no document
// is loaded.
import type {
  ConnectionIndexRow,
  IntegrationIndexRow,
  QueueIndexRow,
} from "./schema.js";

type Json = Record<string, unknown>;

export const INTEGRATION_DOCUMENT_TYPE = "sektar/integration";
export const QUEUE_DOCUMENT_TYPE = "distyra/original-source-queue";
export const CONNECTION_DOCUMENT_TYPE = "powerhouse/connection";

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const num = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

const obj = (v: unknown): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};

const objects = (v: unknown): Json[] =>
  Array.isArray(v)
    ? v.filter((x): x is Json => Boolean(x) && typeof x === "object")
    : [];

/** What an operation's `resultingState` holds: the global state and the document's name. */
export interface Resulting {
  state: Json;
  /** Null when the header is absent; the row then keeps the name it had. */
  name: string | null;
}

/** The global state and the name out of an operation's `resultingState`, if it carries one. */
export function parseResulting(json: string | undefined | null): Resulting | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const all = parsed as Json;
    const header = obj(all.header);
    const name = typeof header.name === "string" ? header.name : null;
    // Every scope, then the header; a bare state from an older transport is the global scope.
    const state =
      all.global && typeof all.global === "object" ? (all.global as Json) : all;
    return { state, name };
  } catch {
    // not JSON: the caller leaves the row as it is
    return null;
  }
}

/* -------------------------------------------------------- integration */

/** An integration's row from its global state. */
export function integrationRow(
  documentId: string,
  state: Json,
  name: string | null,
  at: string,
): IntegrationIndexRow {
  const intent = obj(state.intent);
  const resources = obj(state.resources);
  const source = obj(intent.source);
  const live = obj(intent.live);
  const backfill = obj(intent.backfill);
  const queueIds = objects(backfill.items)
    .map((item) => str(item.documentId))
    .filter((id): id is string => id !== null);
  return {
    document_id: documentId,
    name,
    kind: str(state.kind),
    provider: str(state.provider),
    archived: intent.archived === true,
    live_enabled: live.enabled === true,
    backfill_enabled: backfill.enabled === true,
    live_workflow_id: str(resources.liveWorkflowId),
    backfill_workflow_id: str(resources.backfillWorkflowId),
    connection_id: str(resources.connectionId),
    mailbox: str(source.mailbox),
    address: str(source.address),
    queue_ids: JSON.stringify(queueIds),
    state: JSON.stringify(state),
    updated_at: at,
  };
}

/* -------------------------------------------------------------- queue */

/**
 * How far a queue has walked, from its state: the same rules as
 * `editors/backfills/progress.ts` (`totalOf`, `iterationOf`, `queueProgress`),
 * which the spec checks against it.
 */
export function walkOf(state: Json): {
  total: number;
  iteration: number;
  done: number;
  finished: boolean;
} {
  const cursors = objects(state.cursors);
  const total =
    cursors.length === 0
      ? 0
      : cursors.reduce((product, c) => product * num(c.count), 1);
  const status = str(state.status) ?? "DRAFT";
  const progress = num(state.progress);
  const iteration =
    total === 0
      ? 0
      : status === "FINISHED"
        ? total
        : Math.min(total, Math.round(progress * total) + 1);
  if (status === "FINISHED") return { total, iteration, done: total, finished: true };
  if (status === "DRAFT") return { total, iteration, done: 0, finished: false };
  return { total, iteration, done: Math.max(0, iteration - 1), finished: false };
}

/** A queue's row from its global state. Cursors, queued values and memory stay on the document. */
export function queueRow(
  documentId: string,
  state: Json,
  name: string | null,
  at: string,
): QueueIndexRow {
  const cursors = objects(state.cursors);
  const collections = objects(state.collections);
  const errors = objects(state.errors);
  const description = str(state.description);
  const walk = walkOf(state);
  return {
    document_id: documentId,
    name,
    status: str(state.status) ?? "DRAFT",
    description,
    loops: cursors.length,
    total: walk.total,
    progress: num(state.progress),
    iteration: walk.iteration,
    done: walk.done,
    finished: walk.finished,
    awaiting_values: state.awaitingValues === true,
    error_count: errors.length,
    last_error: str(errors.at(-1)?.message),
    search_text: [
      name,
      description,
      ...cursors.map((c) => str(c.name)),
      ...collections.map((c) => str(c.name)),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    updated_at: at,
  };
}

/* --------------------------------------------------------- connection */

/** A connection's row: what the card says about the sign-in. Config and secret handles stay out. */
export function connectionRow(
  documentId: string,
  state: Json,
  name: string | null,
  at: string,
): ConnectionIndexRow {
  return {
    document_id: documentId,
    name: name ?? str(state.name),
    connector_id: str(state.connectorId),
    account_label: str(state.accountLabel),
    status: str(state.status),
    last_checked_at: str(state.lastCheckedAt),
    last_error: str(state.lastError),
    updated_at: at,
  };
}
