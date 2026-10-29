/**
 * The integration index: the integrations, their backfill queues and their
 * connections, one lean row per document.
 *
 * The top bar's sync chip (on every page), Mail's pull to refresh, the
 * Integrations cards and the Backfills list read these rows instead of the
 * documents. The three types live in three drives (integrations, backfills,
 * workflows); one processor per drive writes whichever of them that drive
 * holds. Rows come off `operation.context.resultingState` (see `rows.ts`);
 * no document is loaded.
 */
export interface IntegrationIndexRow {
  document_id: string;
  /** The document's name (its header). */
  name: string | null;
  /** EMAIL | TRANSACTIONS | CALENDAR | TIME_TRACKING; null until INITIALIZE */
  kind: string | null;
  provider: string | null;
  archived: boolean;
  live_enabled: boolean;
  backfill_enabled: boolean;
  live_workflow_id: string | null;
  backfill_workflow_id: string | null;
  /** The connection the reconciler made (resources.connectionId). */
  connection_id: string | null;
  /** Email: the account's name in Sektar, and its address once signed in. */
  mailbox: string | null;
  address: string | null;
  /** JSON: the backfill queues' document ids, in item order. */
  queue_ids: string;
  /**
   * JSON: the integration's global state. It is small and bounded (at most
   * 20 fixes), and the card, the chip and the detail are pure functions over
   * it (kit/integrations.ts, sync-status.ts, integration-detail.ts), so it is
   * kept whole rather than spread over tables.
   */
  state: string;
  updated_at: string;
}

export interface QueueIndexRow {
  document_id: string;
  name: string | null;
  /** DRAFT | IN_PROGRESS | PAUSED | FINISHED */
  status: string;
  description: string | null;
  /** How many loops (cursors) it has. */
  loops: number;
  /** Positions in the whole space: the product of the loops' counts. */
  total: number;
  /** The fraction walked, as the document says it. */
  progress: number;
  /** Where the walk is, counting from one (progress.ts `iterationOf`). */
  iteration: number;
  /** Slices walked (progress.ts `queueProgress`). */
  done: number;
  finished: boolean;
  awaiting_values: boolean;
  error_count: number;
  /** The last failure's message. */
  last_error: string | null;
  /** Lower-cased haystack: name, description, loop and queue names. */
  search_text: string;
  updated_at: string;
}

export interface ConnectionIndexRow {
  document_id: string;
  name: string | null;
  connector_id: string | null;
  /** The account the connection signed in as, as the connector names it. */
  account_label: string | null;
  /** OK | ERROR | REVOKED | UNCONFIGURED */
  status: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  updated_at: string;
}

export interface DB {
  integration_index: IntegrationIndexRow;
  queue_index: QueueIndexRow;
  connection_index: ConnectionIndexRow;
}
