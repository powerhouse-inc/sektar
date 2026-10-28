/**
 * Sync status (design system: Patterns · Integrations · Sync status): every
 * integration in one line for the top bar, and one row each for the panel
 * behind it, worst first. Kept free of React so it can be tested alone; the
 * chip, the panel and pull to refresh read it.
 */
import type { IntegrationState } from "document-models/integration";
import { cardView, intervalLabel } from "./integrations.js";
import type { TriggerState } from "./workflow-runtime.js";

export type SyncDot = "ok" | "running" | "paused" | "warning" | "error";

export type SyncRow = {
  id: string;
  name: string;
  dot: SyncDot;
  /** What it is doing, in the user's words: "Up to date", "Stopped" */
  meta: string;
  /** How long ago it last synced, short: "4 min", "2 h", "3 d"; "" when never */
  when: string;
  /** The live workflow a sync now runs; null while there is none or live updates are off */
  workflowId: string | null;
};

// Worst first: something that needs attention beats a sync in progress,
// which beats up to date; paused sits last.
const RANK: Record<SyncDot, number> = {
  error: 0,
  warning: 1,
  running: 2,
  ok: 3,
  paused: 4,
};

/** "now", "4 min", "2 h", "3 d": how long ago, as the panel's right column says it. */
export function shortAgo(
  iso: string | null | undefined,
  now = Date.now(),
): string {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86_400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86_400)} d`;
}

/** One integration's row in the panel. Null for one being removed: it is going. */
export function syncRow(
  id: string,
  name: string,
  state: IntegrationState,
  trigger: TriggerState | undefined,
  now = Date.now(),
): SyncRow | null {
  const view = cardView(state);
  const when = shortAgo(trigger?.lastPollAt, now);
  const live =
    state.intent.live.enabled && state.resources.liveWorkflowId
      ? state.resources.liveWorkflowId
      : null;
  const row = (dot: SyncDot, meta: string): SyncRow => ({
    id,
    name,
    dot,
    meta,
    when,
    workflowId: live,
  });
  switch (view.state) {
    case "removing":
      return null;
    case "incomplete":
    case "attention":
      return row("error", view.line);
    case "waiting-for-sign-in":
      return row("warning", "Waiting for sign-in");
    case "applying":
      return row("running", "Setting up");
    case "paused":
      return row("paused", "Live updates paused");
  }
  if (!trigger) {
    return row("ok", `Checks ${intervalLabel(state.intent.live.every)}`);
  }
  if (trigger.status === "PARKED") return row("error", "Stopped");
  if (trigger.status === "ERROR" || trigger.lastError) {
    return row("warning", "Failing");
  }
  if (!trigger.lastPollAt) return row("running", "Starting");
  return row("ok", "Up to date");
}

/** Rows worst first; among equals, by name. */
export function sortRows(rows: readonly SyncRow[]): SyncRow[] {
  return [...rows].sort(
    (a, b) => RANK[a.dot] - RANK[b.dot] || a.name.localeCompare(b.name),
  );
}

export type SyncSummary = {
  dot: SyncDot;
  /** The chip's words: "1 needs attention", "Syncing", "Synced 2 min ago" */
  label: string;
  /** Attention: the chip gets its danger border and bold words */
  attention: boolean;
  /** "5 of 6 up to date", for the panel's head */
  counts: string;
};

/**
 * The chip: the worst state among the rows. Null with no integrations (the
 * chip stays away). `syncing` is a sync now in flight, which reads as
 * Syncing unless something needs attention.
 */
export function syncSummary(
  rows: readonly SyncRow[],
  triggers: ReadonlyMap<string, TriggerState>,
  syncing = false,
  now = Date.now(),
): SyncSummary | null {
  if (rows.length === 0) return null;
  const ok = rows.filter((r) => r.dot === "ok").length;
  const counts = `${ok} of ${rows.length} up to date`;
  const bad = rows.filter((r) => r.dot === "error" || r.dot === "warning");
  if (bad.length > 0) {
    return {
      dot: bad.some((r) => r.dot === "error") ? "error" : "warning",
      label: `${bad.length} ${bad.length === 1 ? "needs" : "need"} attention`,
      attention: true,
      counts,
    };
  }
  if (syncing || rows.some((r) => r.dot === "running")) {
    return { dot: "running", label: "Syncing", attention: false, counts };
  }
  if (ok === 0) {
    return {
      dot: "paused",
      label: "Live updates paused",
      attention: false,
      counts,
    };
  }
  // The most recent sync among the live ones: the line says things are current
  const latest = rows
    .map((r) => (r.workflowId ? triggers.get(r.workflowId)?.lastPollAt : null))
    .filter((t): t is string => Boolean(t))
    .sort()
    .at(-1);
  const when = shortAgo(latest, now);
  return {
    dot: "ok",
    label: !when ? "Up to date" : when === "now" ? "Synced just now" : `Synced ${when} ago`,
    attention: false,
    counts,
  };
}

/** An address as an account: lower case, without a +tag. */
function accountOf(address: string): string {
  const [local = "", domain = ""] = address.toLowerCase().split("@");
  return `${local.split("+")[0]}@${domain}`;
}

/**
 * Whether an integration brings in a mailbox's mail (a pull in Mail syncs
 * those): an email integration whose source is that address; with no
 * address (All inboxes), every email integration.
 */
export function bringsMailFor(
  state: IntegrationState,
  address: string | null,
): boolean {
  if (state.kind !== "EMAIL") return false;
  if (!address) return true;
  const source = state.intent.source as { address?: string | null } | null;
  return Boolean(source?.address) && accountOf(source!.address!) === accountOf(address);
}
