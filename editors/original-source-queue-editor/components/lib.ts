/**
 * Small helpers shared by the queue's panels.
 */
import type { OsqCursor } from "document-models/original-source-queue";
import {
  isCollectionCursor,
  isDateTimeCursor,
} from "document-models/original-source-queue";

/**
 * Render an `unknown` for display.
 *
 * Collection values and memory slots are `Unknown`, so `String(v)` both trips
 * `typescript/no-base-to-string` and prints "[object Object]" for the case
 * that matters most — a queued object.
 */
export function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

/** An instant, trimmed to what a person reads off a backfill. */
export function instant(value: string): string {
  // Kept as stored when it is not parseable rather than guessed at.
  const at = Date.parse(value);
  if (Number.isNaN(at)) return value;
  return new Date(at).toISOString().replace("T", " ").replace(".000Z", "Z");
}

/** What a cursor currently reads, in the form a person wants to see. */
export function readingOf(
  cursor: OsqCursor,
  values: Record<string, unknown[]>,
): { current: string; next: string | null } {
  if (cursor.current === null || cursor.current === undefined) {
    return { current: "—", next: null };
  }
  if (isDateTimeCursor(cursor)) {
    return {
      current: instant(cursor.current),
      next: cursor.next ? instant(cursor.next) : null,
    };
  }
  if (isCollectionCursor(cursor)) {
    // The index is how the machine addresses it; the value is what the
    // reader recognises, so show the value and keep the index as context.
    const queue = values[cursor.collection] ?? [];
    return {
      current: str(queue[cursor.current] ?? `#${String(cursor.current)}`),
      next:
        cursor.next === null || cursor.next === undefined
          ? null
          : str(queue[cursor.next] ?? `#${String(cursor.next)}`),
    };
  }
  return {
    current: str(cursor.current),
    next: cursor.next === null || cursor.next === undefined ? null : str(cursor.next),
  };
}

export const CARD =
  "rounded-lg border border-border bg-card p-4";
export const BTN =
  "rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:hover-effect disabled:cursor-not-allowed disabled:opacity-40";
export const BTN_PRIMARY =
  "rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:hover-effect disabled:cursor-not-allowed disabled:opacity-40";
export const INPUT =
  "rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground";
