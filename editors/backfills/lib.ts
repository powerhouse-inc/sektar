// Reading and writing Original Source Queues from the Backfills workspace.
// Reads are pure helpers over a queue's state; writes are imperative helpers
// around addDocument/dispatchActions, so the panes, the rows and the create
// dialog share one vocabulary. The model's own helpers (cursor kinds, the
// label) come from its barrel; nothing here re-derives what a reducer knows.
import {
  addDocument,
  deleteNode,
  dispatchActions,
  renameDriveNode,
} from "@powerhousedao/reactor-browser";
import { generateId } from "document-model";
import type { QueueState } from "./progress.js";
import type { QueueListRow } from "../sektar/kit/integration-index.js";
import type {
  OriginalSourceQueueAction,
  OsqCollection,
  OsqCursor,
  OsqError,
  OsqStatus,
} from "document-models/original-source-queue";
import {
  actions,
  isCollectionCursor,
  isDateTimeCursor,
  isNumberCursor,
} from "document-models/original-source-queue";
import type { BadgeTone } from "../sektar/kit/format.js";
import type { IconName } from "../sektar/kit/ui.js";

export const OSQ_TYPE = "distyra/original-source-queue";

/* ------------------------------------------------------------- status */

export const STATUS: Record<
  OsqStatus,
  { label: string; tone: BadgeTone; icon: IconName; hint: string }
> = {
  DRAFT: {
    label: "Draft",
    icon: "copy",
    tone: "outline",
    hint: "Being defined. Loops and queues can still change.",
  },
  IN_PROGRESS: {
    label: "Walking",
    icon: "trends",
    tone: "mint",
    hint: "Handing out one position per run of the workflow behind it.",
  },
  PAUSED: {
    label: "Paused",
    icon: "info",
    tone: "warning",
    hint: "Stopped by hand. Resumes exactly where it left off.",
  },
  FINISHED: {
    label: "Finished",
    icon: "check-circle",
    tone: "success",
    hint: "The space is walked, or the walk was ended early.",
  },
};

/**
 * The order of the status groups, in the list and in the status tabs alike:
 * walking, then paused, then drafts, then finished. Within a group the list
 * is alphabetical.
 */
export const STATUS_ORDER: OsqStatus[] = [
  "IN_PROGRESS",
  "PAUSED",
  "DRAFT",
  "FINISHED",
];

export type Filter = "all" | OsqStatus;

/** A row's status as the model names it; an unknown one reads as a draft. */
export function statusOf(row: Pick<QueueListRow, "status">): OsqStatus {
  return STATUS_ORDER.find((s) => s === row.status) ?? "DRAFT";
}

/* ------------------------------------------------------------- reading */

export { iterationOf, totalOf, type QueueState } from "./progress.js";
/** A percentage for a bar or a ring; sub-percent progress shows one decimal. */
export function percentOf(state: Pick<QueueState, "progress">): number {
  return Math.max(0, Math.min(100, state.progress * 100));
}

export function percentLabel(state: Pick<QueueState, "progress">): string {
  const pct = percentOf(state);
  if (pct > 0 && pct < 1) return `${pct.toFixed(1)}%`;
  return `${String(Math.round(pct))}%`;
}

export function kindOf(
  cursor: OsqCursor,
): "number" | "datetime" | "collection" {
  if (isNumberCursor(cursor)) return "number";
  if (isDateTimeCursor(cursor)) return "datetime";
  return "collection";
}

export const KIND: Record<
  "number" | "datetime" | "collection",
  { label: string; icon: IconName }
> = {
  number: { label: "Numbers", icon: "reports" },
  datetime: { label: "Time", icon: "calendar" },
  collection: { label: "Queue", icon: "folder" },
};

const SECOND_UNITS: [number, string][] = [
  [86400 * 7, "week"],
  [86400, "day"],
  [3600, "hour"],
  [60, "minute"],
  [1, "second"],
];

/** A step width in words: "1 week", "12 hours", "90 seconds". */
export function widthOf(seconds: number): string {
  for (const [unit, name] of SECOND_UNITS) {
    if (seconds % unit === 0) {
      const n = seconds / unit;
      return `${String(n)} ${name}${n === 1 ? "" : "s"}`;
    }
  }
  return `${String(seconds)} seconds`;
}

/**
 * A date for a span: the day, in the reader's locale but in UTC, because a
 * backfill's bounds are UTC midnights and a local rendering would show the
 * evening before to anyone east of Greenwich.
 */
export function day(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return iso;
  return new Date(at).toLocaleDateString(undefined, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** An instant as a person reads it: the day, plus the time unless it is midnight UTC. */
export function when(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return iso;
  const d = new Date(at);
  const midnight =
    d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
  if (midnight) return day(iso);
  return `${day(iso)}, ${d.toLocaleTimeString(undefined, { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })} UTC`;
}

/** What a loop currently reads, as a headline and a second line. */
export function readingFor(
  cursor: OsqCursor,
  collections: OsqCollection[],
): { main: string; sub: string | null } {
  if (cursor.current === null || cursor.current === undefined) {
    return { main: "Not started", sub: null };
  }
  if (isDateTimeCursor(cursor)) {
    return {
      main: when(cursor.current),
      sub: cursor.next ? `until ${when(cursor.next)}` : null,
    };
  }
  if (isCollectionCursor(cursor)) {
    const queue = collections.find((c) => c.id === cursor.collection);
    const values = queue?.values ?? [];
    const at = (index: number) => str(values[index] ?? `#${String(index)}`);
    return {
      main: at(cursor.current),
      sub:
        cursor.next === null || cursor.next === undefined
          ? null
          : `next ${at(cursor.next)}`,
    };
  }
  return {
    main: String(cursor.current),
    sub:
      cursor.next === null || cursor.next === undefined
        ? null
        : `next ${String(cursor.next)}`,
  };
}

/** One line on what a loop walks, and which way. */
export function spanOf(
  cursor: OsqCursor,
  collections: OsqCollection[],
): string {
  if (isNumberCursor(cursor)) {
    const down = cursor.last < cursor.first;
    return `${String(cursor.first)} ${down ? "down to" : "up to"} ${String(cursor.last)}, by ${String(cursor.step)}`;
  }
  if (isDateTimeCursor(cursor)) {
    const back = cursor.last < cursor.first;
    return `${day(cursor.first)} ${back ? "back to" : "to"} ${day(cursor.last)}, ${widthOf(cursor.deltaSeconds)} at a time`;
  }
  const queue = collections.find((c) => c.id === cursor.collection);
  return `every value of ${queue?.name ?? "a queue"}`;
}

/** The name of the loop a collection feeds, if one does. */
export function walkedBy(
  collection: OsqCollection,
  cursors: OsqCursor[],
): OsqCursor | undefined {
  return cursors.find(
    (cursor) =>
      isCollectionCursor(cursor) && cursor.collection === collection.id,
  );
}

/** The cursor tuple of a failure, as "Week 2024-03-04 · Label INBOX". */
export function whereOf(error: OsqError, cursors: OsqCursor[]): string {
  return error.cursors
    .map((at) => {
      const cursor = cursors.find((c) => c.id === at.cursor);
      const label = cursor?.name ?? "cursor";
      return `${label} ${str(at.value)}`;
    })
    .join(" · ");
}

/**
 * Render an `unknown` for display. Collection values and memory slots are
 * `Unknown`, and `String(v)` prints "[object Object]" for the case that
 * matters most: a queued object.
 */
export function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

/** A short count: 1,208 → "1.2k" past ten thousand, else grouped. */
export function count(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${count(n)} ${n === 1 ? one : many}`;
}

/**
 * Free-text match over what a person scans a list of backfills by: the
 * name, the description and the loop and queue names (the index row's
 * search text).
 */
export function matchesQueue(
  query: string,
  row: Pick<QueueListRow, "searchText">,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return q.split(/\s+/).every((word) => row.searchText.includes(word));
}

/**
 * Grouped by status in STATUS_ORDER, alphabetical within a group: case is
 * ignored and numbers compare as numbers, so "Q2" sorts before "Q10".
 */
export function sortQueues<T extends Pick<QueueListRow, "status" | "name">>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    const order =
      STATUS_ORDER.indexOf(statusOf(a)) - STATUS_ORDER.indexOf(statusOf(b));
    if (order !== 0) return order;
    return (a.name ?? "").localeCompare(b.name ?? "", undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

/* ------------------------------------------------------------- writing */

export type Dispatch = (
  action: OriginalSourceQueueAction | OriginalSourceQueueAction[],
) => Promise<unknown>;

/** A dispatcher bound to one queue, for panes that act on the one picked. */
export function dispatcherFor(documentId: string): Dispatch {
  return (action) => dispatchActions(action, documentId);
}

/** Lines pasted into a queue: each tried as JSON first, else kept as text. */
export function parseValues(raw: string): unknown[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .map((line) => {
      try {
        return JSON.parse(line) as unknown;
      } catch {
        return line;
      }
    });
}

export type NewCursor =
  | {
      kind: "number";
      name: string;
      first: number;
      last: number;
      step: number;
    }
  | {
      kind: "datetime";
      name: string;
      first: string;
      last: string;
      deltaSeconds: number;
    }
  | { kind: "collection"; name: string; collection: string };

/** The action that creates a loop, from a form's reading of it. */
export function cursorAction(cursor: NewCursor): OriginalSourceQueueAction {
  const id = generateId();
  const name = cursor.name.trim() || undefined;
  if (cursor.kind === "number") {
    return actions.createNumberCursor({
      id,
      name,
      first: cursor.first,
      last: cursor.last,
      step: cursor.step,
    });
  }
  if (cursor.kind === "datetime") {
    return actions.createDateTimeCursor({
      id,
      name,
      first: cursor.first,
      last: cursor.last,
      deltaSeconds: cursor.deltaSeconds,
    });
  }
  return actions.createCollectionCursor({
    id,
    name,
    collection: cursor.collection,
  });
}

export type NewBackfill = {
  name: string;
  description: string;
  /** Loops to define right away, outermost first. */
  cursors: NewCursor[];
  /** Queues to create, with any seed values. */
  collections: { name: string; values: unknown[] }[];
};

/** Create a queue in the drive and define what the dialog asked for. */
export async function createBackfill(
  driveId: string,
  input: NewBackfill,
): Promise<string> {
  const node = await addDocument(driveId, input.name.trim(), OSQ_TYPE);
  const setup: OriginalSourceQueueAction[] = [];
  const description = input.description.trim();
  if (description) setup.push(actions.setDescription({ description }));
  for (const collection of input.collections) {
    setup.push(
      actions.createCollection({
        id: generateId(),
        name: collection.name,
        values: collection.values,
      }),
    );
  }
  for (const cursor of input.cursors) setup.push(cursorAction(cursor));
  if (setup.length > 0) await dispatchActions(setup, node.id);
  return node.id;
}

/** Rename: the document's own name and the drive's node for it, together. */
export async function renameBackfill(
  driveId: string,
  documentId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  await dispatchActions(actions.setName(trimmed), documentId);
  await renameDriveNode(driveId, documentId, trimmed);
}

export function deleteBackfill(driveId: string, documentId: string) {
  return deleteNode(driveId, documentId);
}

/* ------------------------------------------------------------- dialog */

/** Local-time `datetime-local` text for an instant, and back. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): string | null {
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : new Date(at).toISOString();
}

/** Today at midnight, local, and the same day a number of years back. */
export function todayIso(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function yearsAgoIso(years: number, now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString();
}

export const STEP_PRESETS: { value: number; label: string }[] = [
  { value: 3600, label: "1 hour" },
  { value: 86400, label: "1 day" },
  { value: 86400 * 7, label: "1 week" },
  { value: 86400 * 14, label: "2 weeks" },
  { value: 86400 * 30, label: "30 days" },
];
