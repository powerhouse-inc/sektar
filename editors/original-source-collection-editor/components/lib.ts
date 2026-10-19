import type { CSSProperties } from "react";

/**
 * Shared helpers for the collection's panels.
 */
export function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

/** A payload, laid out so a person can actually read it. */
export function pretty(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

/** An instant, trimmed to what fits in a list. */
export function instant(value: string | null | undefined): string {
  if (!value) return "—";
  const at = Date.parse(value);
  if (Number.isNaN(at)) return value;
  return new Date(at).toISOString().slice(0, 16).replace("T", " ");
}

/**
 * The date a row shows, and what it means.
 *
 * When the source says when it actually happened, that is the one worth the
 * space: a mail from the 3rd is a mail from the 3rd however often a re-run
 * sights it again. Capture dates describe the backfill, not the record, so
 * a list scanned by them answers the wrong question — they stay only as the
 * fallback for records whose origin carried no date of its own.
 *
 * The meaning therefore differs per row, which is why the title says which
 * of the two is on show rather than leaving the reader to guess.
 */
export function rowDate(source: {
  occurredAt?: string | null;
  lastSeenAt?: string | null;
}): { text: string; title: string } {
  if (source.occurredAt) {
    return {
      text: instant(source.occurredAt).slice(0, 10),
      title: `happened ${instant(source.occurredAt)}`,
    };
  }
  return {
    text: instant(source.lastSeenAt).slice(0, 10),
    title: `no date at the source — last seen ${instant(source.lastSeenAt)}`,
  };
}

export function bytes(size: number | null | undefined): string {
  if (size === null || size === undefined) return "";
  if (size < 1024) return `${String(size)} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/** The system half of a namespaced identifier — what it came from. */
export function systemOf(identifier: string): string {
  const at = identifier.indexOf(":");
  return at === -1 ? "?" : identifier.slice(0, at);
}

export const CARD = "rounded-lg border border-border bg-card p-4";
export const BTN =
  "rounded-md bg-secondary px-2.5 py-1 text-xs text-secondary-foreground hover:hover-effect disabled:cursor-not-allowed disabled:opacity-40";
export const INPUT =
  // The placeholder colour is explicit: without it the browser picks its
  // own, which is black whatever the theme says, and unreadable on a dark
  // background.
  "rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground";
export const PILL = "rounded-full px-2 py-0.5 text-[0.7rem] font-medium";

/**
 * The backdrop for an image that might be see-through.
 *
 * Fixed mid-greys in both themes, not theme-following. A checker that
 * follows the theme fails in exactly the common case: a dark logo on
 * transparency, viewed in dark mode, disappears into its own backdrop. Two
 * mid tones keep both black and white artwork legible, which is why every
 * image editor uses them regardless of its own chrome.
 */
export const CHECKER: CSSProperties = {
  backgroundImage:
    "repeating-conic-gradient(#9e9e9e 0% 25%, #cfcfcf 0% 50%)",
  backgroundSize: "16px 16px",
};

/**
 * Whether a format can carry an alpha channel.
 *
 * Only these get the checkerboard. A JPEG cannot be transparent, so squares
 * behind one would suggest something about the image that is not true.
 */
export function mayBeTransparent(
  mimeType: string | null | undefined,
  fileName: string,
): boolean {
  const mime = (mimeType ?? "").toLowerCase();
  const name = fileName.toLowerCase();
  return (
    /^image\/(png|gif|webp|avif|svg\+xml|apng)$/.test(mime) ||
    /\.(png|gif|webp|avif|svg)$/.test(name)
  );
}

/**
 * Status as a dot on the row rather than a colour on the group heading.
 *
 * The heading already says which group you are in; repeating that as a
 * coloured block competes with the rows for attention. On the row the colour
 * is doing real work — it is what you scan a list of forty by.
 *
 * NEW reads as an unread dot on purpose: this column is an inbox, and that
 * is the convention people already have for "not dealt with yet".
 */
export const STATUS_DOT: Record<string, string> = {
  NEW: "bg-blue-500",
  PROCESSING: "bg-amber-500",
  COMPLETED: "bg-green-600",
  DISCARDED: "bg-neutral-400",
};

export const TASK_DOT: Record<string, string> = {
  DRAFT: "bg-neutral-400",
  TODO: "bg-amber-500",
  IN_PROGRESS: "bg-blue-500",
  DONE: "bg-green-600",
  CANCELLED: "bg-neutral-400",
};

/** A small round status marker. */
export const DOT = "size-2 shrink-0 rounded-full";

/**
 * Hover and selection in the lists, as two tints of one blue.
 *
 * Two strengths of the same hue rather than two different greys: the
 * relationship between "pointing at" and "chosen" is then legible at a
 * glance, and neither competes with the status dots, which are the only
 * other colour in the column.
 */
export const ROW_HOVER = "hover:bg-blue-500/10";
export const ROW_SELECTED = "bg-blue-500/20";

/**
 * A paperclip that actually looks like one.
 *
 * Connect's UI font has a text-presentation glyph for U+1F4CE and picks
 * it over the colour one, which renders as an unrecognisable squiggle.
 * The variation selector asks for the emoji face, and the font stack
 * makes sure there is one to ask for.
 */
export const PAPERCLIP = "\u{1F4CE}\u{FE0F}";
export const EMOJI_FONT =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/**
 * The pill form of exactly the colours the dots use.
 *
 * Derived rather than restated, because the two were written separately once
 * and drifted: a task in the left list wore one colour and the same task in
 * the record pane wore another, and every source showed the NEW tone
 * regardless of its status. A status that means one thing should not look
 * like two.
 */
function filled(dots: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(dots).map(([status, background]) => [
      status,
      `${background} text-white`,
    ]),
  );
}

export const STATUS_PILL = filled(STATUS_DOT);
export const TASK_PILL = filled(TASK_DOT);
