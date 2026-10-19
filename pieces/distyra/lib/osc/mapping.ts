/**
 * Turning a provider's records into capture records.
 *
 * The gap this fills is small but total. A flow can fetch from Gmail and it
 * can capture into a collection, and it cannot get from one to the other:
 * the expression engine resolves paths and falls back between them, so it
 * can read `steps.find.output.results.messages` whole but cannot touch the
 * elements. Every mapping here — prefixing an id with its namespace, lifting
 * an attachment's `data` into a `ref`, dropping what fell outside the week —
 * is per-element, and per-element is exactly what expressions cannot do.
 *
 * Kept pure and separate from the action for the usual reason: this is where
 * the decisions are, so this is what the tests need to reach.
 *
 * It never transforms the record itself. `payload` is the original, whole and
 * untouched; everything else is a pointer into it. That is the collection's
 * first rule, and the mapper is the easiest place to break it.
 */

export interface AttachmentSpec {
  /** Where the attachment list lives on a record. Absent means none. */
  path?: string;
  /** The store reference. Gmail calls it `data`; the model calls it `ref`. */
  refPath: string;
  namePath: string;
  sizePath?: string;
  mimePath?: string;
}

export interface MappingSpec {
  /** Namespace for the identifier: `gmail` yields `gmail:18f3a`. */
  namespace: string;
  idPath: string;
  /**
   * Extra identifiers, each `path` or `namespace:path`. A bare path reuses
   * the record's namespace; naming one is how an RFC822 Message-ID becomes
   * `rfc822:<…>` rather than pretending to be a Gmail id.
   */
  aliasPaths: string[];
  titlePath?: string;
  contentPath?: string;
  originPath?: string;
  occurredAtPath?: string;
  tags: string[];
  attachments: AttachmentSpec;
  /** The filename, when `extensions` is doing the filtering. */
  namePath?: string;
  /**
   * Keep only these file types, without the dot: `pdf`, `jpg`, `png`.
   *
   * Dropbox cannot filter a listing by type — `search_v2` can, but it
   * demands a query of three characters and so cannot mean "everything of
   * this kind". Doing it here also drops folders, which carry no extension
   * and are not sources.
   */
  extensions: string[];
  /** The field the window is applied to. */
  windowPath?: string;
  /** Half-open [from, to), matching the queue's own interval. */
  from?: string;
  to?: string;
}

export interface MappedAttachment {
  ref: string;
  fileName: string;
  sizeBytes?: number;
  mimeType?: string;
}

export interface MappedRecord {
  externalId: string;
  aliases: string[];
  title?: string;
  origin?: string;
  content?: string;
  payload: unknown;
  attachments: MappedAttachment[];
  tags: string[];
  occurredAt?: string;
}

export interface MappingResult {
  records: MappedRecord[];
  mapped: number;
  /** Dated, but not in this slice. */
  outsideWindow: number;
  /** Undated while a window was set: kept, because losing one is worse. */
  undated: number;
  /** Not one of the wanted file types — a folder, or a .docx among PDFs. */
  wrongType: number;
  /** No identifier, so nothing could own it. */
  unidentified: number;
  /** Characters removed because a jsonb column cannot hold them. */
  scrubbed: number;
}

/**
 * A dotted path into a record.
 *
 * Deliberately plain: no wildcards, no indices, no filters. A path language
 * that can express more than "this field, then that one" is a language, and
 * the point of this module is that the mapping stays inspectable.
 */
/**
 * How to read a path, given the object in front of it.
 *
 * A field name may itself contain dots — Dropbox marks an entry's kind with
 * a key spelled `.tag` — so a path is tried as a literal key before it is
 * split. Splitting first turns `.tag` into ["", "tag"], looks up the empty
 * string, finds nothing, and silently drops every record.
 */
function segmentsOf(record: unknown, path: string): string[] {
  if (
    record !== null &&
    typeof record === "object" &&
    Object.hasOwn(record as Record<string, unknown>, path)
  ) {
    return [path];
  }
  return path.split(".");
}

export function at(record: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  let value: unknown = record;
  for (const segment of segmentsOf(record, path)) {
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

/**
 * Characters a document cannot hold, whatever anyone wants.
 *
 * Document state is stored as `jsonb`, and PostgreSQL rejects two things
 * outright: a NUL, with `unsupported Unicode escape sequence`, and an
 * unpaired surrogate, with `invalid input syntax for type json`. Both turn
 * up in real mail — a NUL inside a tracking URL took out a whole day of
 * Gmail, 104 messages, because one message poisoned the batch.
 *
 * This is the single exception to "capture never transforms". Keeping these
 * characters is not an option that exists: the alternative to removing them
 * is storing nothing at all. So they are removed, counted, and the count is
 * reported, which is the most faithful thing available.
 */
// Built rather than written as a literal: a raw NUL in source is invisible
// in every editor, does not survive a copy-paste, and makes the file binary
// to git and grep alike.
const NUL = new RegExp(String.fromCharCode(0), "g");
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function scrubText(text: string): string {
  return text.replace(NUL, "").replace(LONE_SURROGATE, "");
}

/**
 * The same value with unstorable characters gone.
 *
 * Returns the original reference when nothing needed removing, so a clean
 * record — which is nearly all of them — costs a walk and no copying.
 */
export function scrub(value: unknown, count: { removed: number }): unknown {
  if (typeof value === "string") {
    const cleaned = scrubText(value);
    if (cleaned === value) return value;
    count.removed += value.length - cleaned.length;
    return cleaned;
  }
  if (Array.isArray(value)) {
    // A plain loop rather than `.map()`: control-flow analysis does not
    // follow an assignment made inside a callback, so `changed` would be
    // narrowed to `false` and the copy silently discarded.
    let changed = false;
    const next: unknown[] = [];
    for (const item of value) {
      const cleaned = scrub(item, count);
      if (cleaned !== item) changed = true;
      next.push(cleaned);
    }
    return changed ? next : value;
  }
  if (value !== null && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const cleanKey = scrubText(key);
      const cleaned = scrub(item, count);
      if (cleaned !== item || cleanKey !== key) changed = true;
      next[cleanKey] = cleaned;
    }
    return changed ? next : value;
  }
  return value;
}

/** A field as text, if it is text-shaped. Objects are not. */
export function asText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

/**
 * A field as an instant.
 *
 * Dates survive a step boundary as ISO strings and arrive as Date objects
 * within one, so both have to work; anything unparsable is absent rather
 * than `Invalid Date`, which would poison a comparison silently.
 */
export function asInstant(value: unknown): string | undefined {
  const text = asText(value);
  if (!text) return undefined;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

/**
 * A field as a URL, or nothing.
 *
 * `origin` is a URL in the model, so a Dropbox path handed to it would be
 * rejected at capture — after the fetch, and for the whole batch. Checking
 * here turns that into a field this record simply does not have.
 */
function asUrl(value: unknown): string | undefined {
  const text = asText(value);
  if (!text) return undefined;
  try {
    return new URL(text).toString();
  } catch {
    return undefined;
  }
}

/** `gmail` + `18f3a` becomes `gmail:18f3a`, and never `gmail:gmail:18f3a`. */
function namespaced(namespace: string, value: string): string {
  const prefix = `${namespace}:`;
  return value.startsWith(prefix) ? value : prefix + value;
}

/** `rfc822:messageId` names its own namespace; `messageId` reuses the record's. */
function splitAliasPath(
  entry: string,
  fallback: string,
): { namespace: string; path: string } {
  const colon = entry.indexOf(":");
  if (colon === -1) return { namespace: fallback, path: entry.trim() };
  return {
    namespace: entry.slice(0, colon).trim(),
    path: entry.slice(colon + 1).trim(),
  };
}

function attachmentsOf(
  record: unknown,
  spec: AttachmentSpec,
): MappedAttachment[] {
  const raw = at(record, spec.path);
  if (!Array.isArray(raw)) return [];
  const mapped: MappedAttachment[] = [];
  for (const entry of raw) {
    const ref = asText(at(entry, spec.refPath));
    // No ref, no attachment: a name alone points at nothing, and an
    // attachment the store cannot serve is worse than an absent one.
    if (!ref) continue;
    const size = at(entry, spec.sizePath);
    const mimeType = asText(at(entry, spec.mimePath));
    mapped.push({
      ref,
      fileName: asText(at(entry, spec.namePath)) ?? "attachment",
      ...(typeof size === "number" ? { sizeBytes: size } : {}),
      ...(mimeType ? { mimeType } : {}),
    });
  }
  return mapped;
}

/**
 * Whether a filename is one of the wanted types.
 *
 * An empty list wants everything — the filter is opt-in, so a provider that
 * has already narrowed the set does not have to restate it.
 */
export function hasWantedExtension(
  name: string | undefined,
  extensions: string[],
): boolean {
  if (extensions.length === 0) return true;
  if (!name) return false;
  const lower = name.toLowerCase();
  return extensions.some((extension) => {
    const suffix = extension.trim().replace(/^\./, "").toLowerCase();
    // The dot is required, or `pdf` would also match `notapdf`.
    return suffix !== "" && lower.endsWith(`.${suffix}`);
  });
}

/** Whether an instant falls in [from, to). */
export function inWindow(
  instant: string,
  from: string | undefined,
  to: string | undefined,
): boolean {
  if (from && instant < from) return false;
  // Half-open, so a record exactly on the upper bound belongs to the NEXT
  // slice. Inclusive at both ends would capture every boundary twice.
  if (to && instant >= to) return false;
  return true;
}

export function mapRecords(
  records: unknown[],
  spec: MappingSpec,
): MappingResult {
  const scrubCount = { removed: 0 };
  const mapped: MappedRecord[] = [];
  let outsideWindow = 0;
  let undated = 0;
  let wrongType = 0;
  let unidentified = 0;

  const windowed = Boolean(spec.windowPath && (spec.from ?? spec.to));

  for (const original of records) {
    // Scrubbed before anything is read out of it, so every derived field and
    // the payload alike are storable. A clean record is returned unchanged,
    // so this costs a walk and no copying for almost all of them.
    const record = scrub(original, scrubCount);
    const name = asText(at(record, spec.namePath));
    if (!hasWantedExtension(name, spec.extensions)) {
      wrongType++;
      continue;
    }

    const id = asText(at(record, spec.idPath));
    if (!id) {
      unidentified++;
      continue;
    }

    const occurredAt = asInstant(at(record, spec.occurredAtPath));
    if (windowed) {
      const stamp = asInstant(at(record, spec.windowPath));
      if (!stamp) {
        // Kept, and counted. A record whose timestamp is unreadable still
        // happened; dropping it would lose it from every slice at once and
        // leave no trace that it had been seen.
        undated++;
      } else if (!inWindow(stamp, spec.from, spec.to)) {
        outsideWindow++;
        continue;
      }
    }

    const externalId = namespaced(spec.namespace, id);
    const aliases: string[] = [];
    for (const entry of spec.aliasPaths) {
      const { namespace, path } = splitAliasPath(entry, spec.namespace);
      const value = asText(at(record, path));
      if (!value) continue;
      const alias = namespaced(namespace, value);
      // The canonical id is not one of its own aliases, and a repeated path
      // is not two identifiers.
      if (alias !== externalId && !aliases.includes(alias)) aliases.push(alias);
    }

    const title = asText(at(record, spec.titlePath));
    const content = asText(at(record, spec.contentPath));
    const origin = asUrl(at(record, spec.originPath));

    mapped.push({
      externalId,
      aliases,
      ...(title ? { title } : {}),
      ...(origin ? { origin } : {}),
      ...(content ? { content } : {}),
      // The record entire, exactly as it arrived. Capture never transforms.
      payload: record,
      attachments: attachmentsOf(record, spec.attachments),
      tags: spec.tags,
      ...(occurredAt ? { occurredAt } : {}),
    });
  }

  return {
    records: mapped,
    mapped: mapped.length,
    outsideWindow,
    undated,
    wrongType,
    unidentified,
    scrubbed: scrubCount.removed,
  };
}
