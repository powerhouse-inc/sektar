/**
 * What the welcome page's sidebar shows, kept free of React so it can be
 * tested on its own: which of the accounts Sektar works from are still to be
 * connected, and which backfills are not finished. Both read the integration
 * index (kit/integration-index), never the documents.
 *
 * `undefined` means the index has not answered: still loading, or the read
 * failed and is being retried. Nothing is known then, so nothing is reported
 * as missing.
 */
import type { IntegrationKind, IntegrationState } from "document-models/integration";
import type { QueueListRow } from "../../../processors/integration-index/index.js";
import { sortQueues, statusOf } from "../../backfills/lib.js";

/** The kinds the welcome page asks for, in the order it lists them. */
export const SETUP_KINDS = [
  "EMAIL",
  "CALENDAR",
  "TRANSACTIONS",
] as const satisfies readonly IntegrationKind[];

export type SetupKind = (typeof SETUP_KINDS)[number];

type SetupItem = {
  state: {
    kind?: IntegrationState["kind"];
    intent: Pick<IntegrationState["intent"], "archived">;
  };
};

/**
 * The kinds nothing is set up for. A kind is set up when an integration of
 * that kind exists and is not being removed, whatever state it is in: one
 * waiting for sign-in, paused, applying or failing is on the Integrations page
 * with its own card, so it is not missing, and connecting it again would make
 * a second one. One that is being removed (archived) is going away, and one
 * whose setup never picked a kind counts for no kind.
 */
export function missingKinds(items: readonly SetupItem[] | undefined): SetupKind[] {
  if (!items) return [];
  const present = new Set(
    items
      .filter((item) => !item.state.intent.archived)
      .map((item) => item.state.kind),
  );
  return SETUP_KINDS.filter((kind) => !present.has(kind));
}

/**
 * The backfills still to finish, in the Backfills page's order: walking, then
 * paused, then drafts, alphabetical within each.
 */
export function unfinishedBackfills<
  T extends Pick<QueueListRow, "status" | "name" | "finished">,
>(rows: readonly T[] | undefined): T[] {
  if (!rows) return [];
  return sortQueues(
    rows.filter((row) => !row.finished && statusOf(row) !== "FINISHED"),
  );
}
