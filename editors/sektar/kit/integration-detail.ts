/**
 * The integration detail page (design system: Patterns · Integrations ·
 * Detail): what the live updates brought in, the runs behind them, the
 * backfills and what the reconciler found. Pure: the page reads the
 * integration, the runtime's runs and the backfill queues, and these turn
 * them into the words it shows.
 */
import type {
  IntegrationKind,
  IntegrationState,
} from "document-models/integration";
import type { QueueProgress } from "../../backfills/progress.js";
import { ago } from "./folder-sync.js";
import { intervalLabel, sliceUnit } from "./integrations.js";
import type { IconName } from "./ui.js";

/** A run as the detail page reads it from the runtime. */
export type RunRecord = {
  id: string;
  status: string;
  error: string | null;
  startedAt: string;
  endedAt: string | null;
  triggerKind: string | null;
  triggerPayload?: unknown;
  workflowName?: string | null;
  steps: { stepKey: string; status: string; output: unknown }[];
};

/** What one run wrote: documents created, updated, and items it could not write. */
export type Brought = { created: number; updated: number; failed: number };

const size = (value: unknown): number =>
  Array.isArray(value) ? value.length : typeof value === "number" ? value : 0;

/**
 * What a run brought in, summed over the steps that write documents (an
 * upsert reports created / updated / failed, a bank import one per
 * account). Null when no step reports it: the run stopped before writing.
 */
export function broughtIn(steps: RunRecord["steps"]): Brought | null {
  let found = false;
  const total: Brought = { created: 0, updated: 0, failed: 0 };
  for (const step of steps) {
    const out = step.output as Record<string, unknown> | null | undefined;
    if (!out || typeof out !== "object") continue;
    // A bank import says how many it imported
    if ("imported" in out) {
      found = true;
      total.created += size(out.imported);
      continue;
    }
    if (!("created" in out) && !("updated" in out)) continue;
    found = true;
    total.created += size(out.created);
    total.updated += size(out.updated);
    total.failed += size(out.failed);
  }
  return found ? total : null;
}

/** What an integration of a kind brings in, one and many. */
export function itemNoun(kind: IntegrationKind | null | undefined): {
  one: string;
  many: string;
} {
  switch (kind) {
    case "EMAIL":
      return { one: "message", many: "messages" };
    case "CALENDAR":
      return { one: "event", many: "events" };
    case "TRANSACTIONS":
      return { one: "transaction", many: "transactions" };
    default:
      return { one: "item", many: "items" };
  }
}

const count = (n: number) => n.toLocaleString("en-GB");
const plural = (n: number, noun: { one: string; many: string }) =>
  `${count(n)} ${n === 1 ? noun.one : noun.many}`;

/**
 * "3 new messages", "1 new event · 2 updated", "Nothing new". A mail check
 * reads the latest messages again and matches the ones already in, so its
 * updates change nothing and are left out; a calendar fires only for events
 * that changed, so its updates are news.
 */
export function broughtLine(
  b: Brought,
  kind: IntegrationKind | null | undefined,
): string {
  const noun = itemNoun(kind);
  const parts = [
    b.created > 0 ? `${plural(b.created, noun).replace(/ /, " new ")}` : null,
    kind === "CALENDAR" && b.updated > 0 ? `${count(b.updated)} updated` : null,
    b.failed > 0 ? `${count(b.failed)} not written` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Nothing new";
}

/** "14:05" today, "27 Oct" before */
export function clock(iso: string, now = Date.now()): string {
  const d = new Date(iso);
  const today = new Date(now);
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "took 4 s", "took 2 min" */
function took(run: RunRecord): string | null {
  if (!run.endedAt) return null;
  const s = Math.round(
    (Date.parse(run.endedAt) - Date.parse(run.startedAt)) / 1000,
  );
  return s < 90 ? `took ${Math.max(s, 0)} s` : `took ${Math.round(s / 60)} min`;
}

/** How the run started, in words: a check, Sync now, Try again */
function startedBy(kind: string | null): string {
  if (kind === "rerun") return "Tried again";
  if (kind === "manual") return "Started by hand";
  return "Scheduled check";
}

/** The runtime's error, without its own prefix */
export function errorWords(error: string | null): string {
  if (!error) return "No reason given";
  return error
    .replace(/^Skipped: /, "")
    .replace(/^Step "[^"]+" failed: /, "")
    .slice(0, 240);
}

export type FeedRow = {
  key: string;
  icon: IconName;
  /** A failed or skipped run: the icon shows it */
  problem: boolean;
  text: string;
  bold: boolean;
  sub: string;
  time: string;
};

/** The Recent runs feed, newest first. */
export function runFeed(
  runs: readonly RunRecord[],
  kind: IntegrationKind | null | undefined,
  now = Date.now(),
): FeedRow[] {
  return runs.map((run) => {
    const base = {
      key: run.id,
      time: clock(run.startedAt, now),
    };
    if (run.status === "SUCCEEDED") {
      const b = broughtIn(run.steps);
      const text = b ? broughtLine(b, kind) : "Done";
      return {
        ...base,
        icon: "check-circle" as const,
        problem: false,
        text,
        bold: text !== "Nothing new" && text !== "Done",
        sub: [startedBy(run.triggerKind), took(run)]
          .filter(Boolean)
          .join(" · "),
      };
    }
    if (run.status === "FAILED") {
      return {
        ...base,
        icon: "info" as const,
        problem: true,
        text: "Failed",
        bold: true,
        sub: errorWords(run.error),
      };
    }
    if (run.status === "CANCELLED") {
      return {
        ...base,
        icon: "info" as const,
        problem: true,
        text: run.error?.startsWith("Skipped") ? "Skipped" : "Stopped",
        bold: false,
        sub: errorWords(run.error),
      };
    }
    return {
      ...base,
      icon: "sync" as const,
      problem: false,
      text: run.status === "PENDING" ? "Waiting" : "Running",
      bold: false,
      sub: `since ${clock(run.startedAt, now)}`,
    };
  });
}

/** When the next check is due: "in 3 min", "now", "" while there is none. */
export function nextCheck(
  iso: string | null | undefined,
  now = Date.now(),
): string {
  if (!iso) return "";
  const s = Math.round((Date.parse(iso) - now) / 1000);
  if (s <= 30) return "now";
  if (s < 3600) return `in ${Math.round(s / 60)} min`;
  if (s < 86_400) return `in ${Math.round(s / 3600)} h`;
  return `in ${Math.round(s / 86_400)} d`;
}

/** "Last synced": when, and what the last run that wrote brought in. */
export function lastSynced(
  lastPollAt: string | null | undefined,
  runs: readonly RunRecord[],
  kind: IntegrationKind | null | undefined,
  now = Date.now(),
): { when: string; detail: string } | null {
  if (!lastPollAt) return null;
  const last = runs.find((r) => r.status === "SUCCEEDED");
  const b = last ? broughtIn(last.steps) : null;
  return {
    when: ago(lastPollAt, now),
    detail: [
      clock(lastPollAt, now),
      b ? broughtLine(b, kind).replace(/^Nothing new$/, "nothing new") : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Capitalised: "Every 5 minutes" */
export function frequency(state: IntegrationState): string {
  const words = intervalLabel(state.intent.live.every);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The source in a badge: "All mail", "4 folders", "2 accounts", "All calendars" */
export function sourceBadge(state: IntegrationState): string | null {
  const source = state.intent.source as Record<string, unknown> | null;
  if (!source) return null;
  if (Array.isArray(source.folders)) {
    const n = source.folders.length;
    return n === 0 ? "All mail" : n === 1 ? "1 folder" : `${n} folders`;
  }
  if (Array.isArray(source.accounts)) {
    const n = source.accounts.length;
    return n === 1 ? "1 account" : `${n} accounts`;
  }
  if (source.allOwned === true) return "All calendars";
  if (Array.isArray(source.calendars)) {
    const n = source.calendars.length;
    return n === 1 ? "1 calendar" : `${n} calendars`;
  }
  return null;
}

/**
 * Whether the live workflow is stuck: a run has been going far longer than
 * any check takes. Null while nothing is.
 */
export function stuckSince(
  runs: readonly RunRecord[],
  now = Date.now(),
  afterMs = 30 * 60_000,
): { since: string; waiting: number } | null {
  const running = runs.filter((r) => r.status === "RUNNING");
  const oldest = running.at(-1);
  if (!oldest || now - Date.parse(oldest.startedAt) < afterMs) return null;
  return {
    since: clock(oldest.startedAt, now),
    waiting: runs.filter((r) => r.status === "PENDING").length,
  };
}

const SKIPPED = "Skipped:";

/** The payload a run was fired with, as a key to compare runs by. */
const payloadKey = (run: RunRecord) =>
  JSON.stringify(run.triggerPayload ?? null);

/**
 * Backfill slices the runtime refused to run (skipped while parked, expired
 * in the queue, dropped as the queue was full) that no later run brought in,
 * oldest first. The cursor had already moved past them, so nothing brings
 * them in unless they are fired again with their payload. Runs that failed
 * are left to Try again.
 */
export function missedSlices(newestFirst: readonly RunRecord[]): RunRecord[] {
  const done = new Set(
    newestFirst.filter((r) => r.status === "SUCCEEDED").map(payloadKey),
  );
  const seen = new Set<string>();
  const missed: RunRecord[] = [];
  for (const run of newestFirst) {
    if (run.status !== "CANCELLED" || !run.error?.startsWith(SKIPPED)) continue;
    const key = payloadKey(run);
    if (done.has(key) || seen.has(key) || run.triggerPayload == null) continue;
    seen.add(key);
    missed.push(run);
  }
  return missed.reverse();
}

/** The window a backfill run worked on: "4 Feb 2014" */
export function sliceLabel(run: RunRecord): string | null {
  const payload = run.triggerPayload as
    | { ranges?: Record<string, { from?: string }> }
    | null
    | undefined;
  const ranges = payload?.ranges;
  const from = ranges ? Object.values(ranges)[0]?.from : undefined;
  return from
    ? new Date(from).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
}

/**
 * How fast the backfill goes, from its recent runs: the time between the
 * slices it finished. Null with fewer than three to go by.
 */
export function backfillPace(
  newestFirst: readonly RunRecord[],
): { msPerSlice: number } | null {
  const ends = newestFirst
    .filter((r) => r.status === "SUCCEEDED" && r.endedAt)
    .slice(0, 20)
    .map((r) => Date.parse(r.endedAt as string));
  if (ends.length < 3) return null;
  const span = ends[0] - ends[ends.length - 1];
  return span > 0 ? { msPerSlice: span / (ends.length - 1) } : null;
}

/** "about 3 hours", "about 2 days" */
export function aboutDuration(ms: number): string {
  const min = ms / 60_000;
  if (min < 90) return `about ${Math.max(1, Math.round(min))} min`;
  const h = min / 60;
  if (h < 36) return `about ${Math.round(h)} hours`;
  return `about ${Math.round(h / 24)} days`;
}

/** "a day every 2 min" */
export function paceLine(
  msPerSlice: number,
  stepSeconds: number | null,
): string {
  const unit = stepSeconds ? sliceUnit(stepSeconds) : "slices";
  const one =
    unit === "days" ? "a day" : unit === "weeks" ? "a week" : "a slice";
  const min = msPerSlice / 60_000;
  const every =
    min < 1.5
      ? "every minute"
      : min < 90
        ? `every ${Math.round(min)} min`
        : `every ${Math.round(min / 60)} hours`;
  return `${one} ${every}`;
}

export type BackfillRow = {
  id: string;
  label: string;
  /** "Date range", "Folders", "Gap" */
  badge: string;
  meta: string;
  status: "active" | "done" | "waiting" | "starting";
  percent: number;
};

/** One row per backfill item, in the order they run. */
export function backfillRows(
  state: IntegrationState,
  progress: ReadonlyMap<string, QueueProgress>,
  /** For an adopted backfill, which carries no slice size of its own */
  defaultUnit = "slices",
): BackfillRow[] {
  return state.intent.backfill.items.map((item) => {
    const p = item.documentId ? progress.get(item.documentId) : undefined;
    const request = item.request as {
      stepSeconds?: number;
      folders?: string[];
    } | null;
    const gap = item.label.startsWith("Gap:");
    const badge = gap
      ? "Gap"
      : Array.isArray(request?.folders)
        ? "Folders"
        : "Date range";
    const unit = request?.stepSeconds
      ? sliceUnit(request.stepSeconds)
      : defaultUnit;
    const label = gap ? item.label.replace(/^Gap:\s*/, "") : item.label;
    if (!p) {
      return {
        id: item.id,
        label,
        badge,
        meta: "Not started",
        status: "starting",
        percent: 0,
      };
    }
    const percent = p.total === 0 ? 100 : Math.round((p.done / p.total) * 100);
    if (p.finished) {
      return {
        id: item.id,
        label,
        badge,
        meta: `${count(p.total)} ${unit}`,
        status: "done",
        percent: 100,
      };
    }
    const active = state.resources.pluggedItemId === item.id;
    return {
      id: item.id,
      label,
      badge,
      meta: `${count(p.done)} of ${count(p.total)} ${unit}`,
      status: active ? "active" : "waiting",
      percent,
    };
  });
}

/** Slices left over every unfinished backfill. */
export function slicesLeft(
  state: IntegrationState,
  progress: ReadonlyMap<string, QueueProgress>,
): number {
  return state.intent.backfill.items.reduce((n, item) => {
    const p = item.documentId ? progress.get(item.documentId) : undefined;
    return p && !p.finished ? n + (p.total - p.done) : n;
  }, 0);
}

export type SetupRow = {
  key: string;
  icon: IconName;
  problem: boolean;
  text: string;
  sub: string;
  time: string;
};

/**
 * The Setup feed: what the reconciler found on its last pass (what is
 * wrong, and whether Sektar or only you can fix it), then what it put back.
 * When nothing is wrong it says so first.
 */
export function setupRows(
  state: IntegrationState,
  now = Date.now(),
): SetupRow[] {
  const rows: SetupRow[] = [];
  const issues = state.check?.issues ?? [];
  if (state.check && issues.length === 0) {
    rows.push({
      key: "ok",
      icon: "check-circle",
      problem: false,
      text: "Everything is set up as you asked",
      sub: "The workflows match this integration",
      time: "",
    });
  }
  for (const issue of issues) {
    rows.push({
      key: `${issue.code}:${issue.subject ?? ""}`,
      icon: "info",
      problem: issue.severity !== "INFO",
      text: issue.message,
      sub: issue.fixable
        ? "Sektar sets this right on its next check"
        : "Only you can fix this",
      time: clock(issue.since, now),
    });
  }
  for (const [i, fix] of state.fixes.slice(0, 5).entries()) {
    rows.push({
      key: `fix:${i}:${fix.at}`,
      icon: "info",
      problem: false,
      text: fix.message.startsWith("Put back")
        ? fix.message
        : `Put back: ${fix.message}`,
      sub: "Changed outside this integration; Sektar set it back",
      time: clock(fix.at, now),
    });
  }
  return rows;
}

/** "checked 2 min ago", or "" before the first check */
export function checkedAgo(state: IntegrationState, now = Date.now()): string {
  return state.check ? `checked ${ago(state.check.at, now)}` : "";
}
