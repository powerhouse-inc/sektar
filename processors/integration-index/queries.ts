// The questions the sync chip, the Integrations page and the Backfills list
// ask of the integration index, as queries over it. Shared by the subgraph
// (the switchboard answers Connect over GraphQL) and by a tab whose own
// reactor runs the processor (a live query), so the two never disagree.
// The declarations name kysely's builder types (these queries return them):
// importing the package lets tsc refer to "kysely", not to a path into .pnpm.
import type {} from "kysely";
import type { IRelationalDb } from "@powerhousedao/reactor-browser";
import type {
  ConnectionIndexRow,
  DB,
  IntegrationIndexRow,
  QueueIndexRow,
} from "./schema.js";

/** What both a namespaced query builder and a Kysely instance offer. */
export type IntegrationQueryBuilder = Pick<IRelationalDb<DB>, "selectFrom">;

/** At most this many ids per question: a drive holds tens of these documents. */
export const IDS_MAX = 500;

/** An integration as the chip, the cards and pull to refresh read it. */
export interface IntegrationListRow {
  id: string;
  name: string | null;
  kind: string | null;
  provider: string | null;
  archived: boolean;
  liveEnabled: boolean;
  backfillEnabled: boolean;
  liveWorkflowId: string | null;
  backfillWorkflowId: string | null;
  connectionId: string | null;
  mailbox: string | null;
  address: string | null;
  queueIds: string[];
  /** JSON: the integration's global state, for the kit's pure functions. */
  state: string;
  updatedAt: string;
}

/** A backfill queue as the Backfills list and a card's progress read it. */
export interface QueueListRow {
  id: string;
  name: string | null;
  status: string;
  description: string | null;
  loops: number;
  total: number;
  progress: number;
  iteration: number;
  done: number;
  finished: boolean;
  awaitingValues: boolean;
  errorCount: number;
  lastError: string | null;
  /** Lower-cased: name, description, loop and queue names. */
  searchText: string;
  updatedAt: string;
}

/** A connection as a card's account line and the detail's Connection row read it. */
export interface ConnectionListRow {
  id: string;
  name: string | null;
  connectorId: string | null;
  accountLabel: string | null;
  status: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
  updatedAt: string;
}

/** Ids as asked: distinct, non-empty, capped. */
export function cleanIds(ids: readonly string[] | null | undefined): string[] {
  return [...new Set((ids ?? []).filter((id) => typeof id === "string" && id))].slice(0, IDS_MAX);
}

/** Every integration of the drive, by name. */
export function integrationsQuery(db: IntegrationQueryBuilder) {
  return db
    .selectFrom("integration_index")
    .selectAll()
    .orderBy("name", "asc")
    .orderBy("document_id", "asc");
}

/** The queues of the drive: every one, or those of `ids` (never an empty list). */
export function queuesQuery(db: IntegrationQueryBuilder, ids: readonly string[] | null) {
  const q = db
    .selectFrom("queue_index")
    .selectAll()
    .orderBy("name", "asc")
    .orderBy("document_id", "asc");
  return ids ? q.where("document_id", "in", [...ids]) : q;
}

/** The connections of `ids` (never an empty list). */
export function connectionsQuery(db: IntegrationQueryBuilder, ids: readonly string[]) {
  return db
    .selectFrom("connection_index")
    .selectAll()
    .where("document_id", "in", [...ids])
    .orderBy("document_id", "asc");
}

function parseIds(text: string | null): string[] {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** A stored integration row in the list's vocabulary. */
export function toIntegrationRow(r: IntegrationIndexRow): IntegrationListRow {
  return {
    id: r.document_id,
    name: r.name,
    kind: r.kind,
    provider: r.provider,
    archived: Boolean(r.archived),
    liveEnabled: Boolean(r.live_enabled),
    backfillEnabled: Boolean(r.backfill_enabled),
    liveWorkflowId: r.live_workflow_id,
    backfillWorkflowId: r.backfill_workflow_id,
    connectionId: r.connection_id,
    mailbox: r.mailbox,
    address: r.address,
    queueIds: parseIds(r.queue_ids),
    state: r.state,
    updatedAt: r.updated_at,
  };
}

/** A stored queue row in the list's vocabulary. */
export function toQueueRow(r: QueueIndexRow): QueueListRow {
  return {
    id: r.document_id,
    name: r.name,
    status: r.status,
    description: r.description,
    loops: Number(r.loops),
    total: Number(r.total),
    progress: Number(r.progress),
    iteration: Number(r.iteration),
    done: Number(r.done),
    finished: Boolean(r.finished),
    awaitingValues: Boolean(r.awaiting_values),
    errorCount: Number(r.error_count),
    lastError: r.last_error,
    searchText: r.search_text,
    updatedAt: r.updated_at,
  };
}

/** A stored connection row in the list's vocabulary. */
export function toConnectionRow(r: ConnectionIndexRow): ConnectionListRow {
  return {
    id: r.document_id,
    name: r.name,
    connectorId: r.connector_id,
    accountLabel: r.account_label,
    status: r.status,
    lastCheckedAt: r.last_checked_at,
    lastError: r.last_error,
    updatedAt: r.updated_at,
  };
}
