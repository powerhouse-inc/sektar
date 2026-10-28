/**
 * Coverage (integrations design §7): which stretch of time an integration's
 * backfills cover together, and the holes between them. A queue counts for
 * its whole range while it walks: it will get there. A hole of a day or more
 * between the earliest start and the latest end is a gap the reconciler
 * fills with a new backfill; overlaps are harmless, imports deduplicate.
 */
import type { QueueState } from "../../editors/backfills/progress.js";
import type { BackfillItem } from "./backfill-osq.js";

export type Span = { from: number; to: number };

const DAY_MS = 86_400_000;

/** A queue's range: its first date-time cursor, whichever way it walks. */
export function queueSpan(state: QueueState): Span | null {
  const cursor = state.cursors.find((c) => "deltaSeconds" in c) as
    | { first?: string; last?: string }
    | undefined;
  if (!cursor?.first || !cursor.last) return null;
  const a = Date.parse(cursor.first);
  const b = Date.parse(cursor.last);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

/** What an item covers: its queue's range, or what it asks for until the queue exists. */
export function itemSpan(
  item: BackfillItem,
  queue: QueueState | undefined,
): Span | null {
  if (queue) return queueSpan(queue);
  const r = item.request as { from?: string; to?: string } | null;
  if (!r?.from || !r.to) return null;
  const a = Date.parse(r.from);
  const b = Date.parse(r.to);
  return Number.isNaN(a) || Number.isNaN(b)
    ? null
    : { from: Math.min(a, b), to: Math.max(a, b) };
}

/** The holes of at least `minMs` between spans, from the earliest start to the latest end. */
export function coverageGaps(spans: Span[], minMs = DAY_MS): Span[] {
  const sorted = [...spans].sort((x, y) => x.from - y.from);
  const gaps: Span[] = [];
  let reach = -Infinity;
  for (const s of sorted) {
    if (reach !== -Infinity && s.from - reach >= minMs) {
      gaps.push({ from: reach, to: s.from });
    }
    reach = Math.max(reach, s.to);
  }
  return gaps;
}

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "12 Aug 2025 – 1 Jan 2026" */
export function spanLabel(span: Span): string {
  return `${DATE.format(new Date(span.from))} – ${DATE.format(new Date(span.to))}`;
}
