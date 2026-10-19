/**
 * Turning a listing into the queue actions that record what it found.
 *
 * The discover-then-drain half of the queue, which is what the model's live
 * collections exist for: "values may be pushed while the walk is running,
 * which is what makes discover-then-drain backfills expressible".
 *
 * Walking a folder tree this way is the answer to a provider that cannot
 * filter by date and cannot paginate — Dropbox's `list_folder` caps at 2000
 * entries and returns them in arbitrary order, so a recursive listing of the
 * root is both truncated and useless. One folder per iteration stays under
 * the cap, and the tree extends the queue as it is walked.
 *
 * Kept pure and separate from the action so the two decisions that are easy
 * to get wrong — not re-queueing a folder, and not emitting an empty push —
 * can be tested without a document.
 */

export interface DiscoveryInput {
  /** The listing to read. */
  records: unknown[];
  /** Field holding the value to queue, e.g. `path_lower`. */
  valuePath: string;
  /** Optional filter, e.g. `.tag` must equal `folder`. */
  wherePath?: string;
  whereEquals?: string;
  /** What the collection already holds, so a re-run queues nothing twice. */
  existing: unknown[];
}

export interface DiscoveryResult {
  /** New values, in listing order, deduplicated against `existing`. */
  values: string[];
  /** Values that were already queued. */
  alreadyQueued: number;
  /** Records the filter rejected. */
  skipped: number;
}

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

function at(record: unknown, path: string): unknown {
  let value: unknown = record;
  for (const segment of segmentsOf(record, path)) {
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Record<string, unknown>)[segment];
  }
  return value;
}

function asText(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

/**
 * The new values a listing contributes.
 *
 * Deduplicated against what the collection already holds AND within the
 * batch. Without the first, a folder re-listed after a failed run queues its
 * children a second time and the walk never ends; without the second, a
 * listing that repeats a path does the same on a smaller scale.
 */
export function discover(input: DiscoveryInput): DiscoveryResult {
  const seen = new Set(
    input.existing.map((value) => asText(value)).filter((v) => v !== undefined),
  );
  const values: string[] = [];
  let alreadyQueued = 0;
  let skipped = 0;

  for (const record of input.records) {
    if (input.wherePath !== undefined && input.whereEquals !== undefined) {
      const actual = asText(at(record, input.wherePath));
      if (actual !== input.whereEquals) {
        skipped++;
        continue;
      }
    }
    const value = asText(at(record, input.valuePath));
    if (value === undefined) {
      skipped++;
      continue;
    }
    if (seen.has(value)) {
      alreadyQueued++;
      continue;
    }
    seen.add(value);
    values.push(value);
  }

  return { values, alreadyQueued, skipped };
}

export interface QueueAction {
  type: string;
  input: Record<string, unknown>;
}

/**
 * The actions to dispatch at the queue: record what was found, then move on.
 *
 * Both in one dispatch, deliberately. They target the same document, so
 * sending them together makes it impossible to advance past a folder without
 * having recorded the folders it contained — which, on a walk that extends
 * itself, would silently prune a whole subtree.
 *
 * It also sidesteps an empty push. `ADD_COLLECTION_VALUE` rejects an empty
 * value list, and a leaf folder legitimately discovers nothing; appending
 * PROCEED means the batch is never empty and the leaf case needs no branch.
 */
export function queueActions(
  collection: string,
  values: string[],
  proceed: boolean,
): QueueAction[] {
  const actions: QueueAction[] = [];
  if (values.length > 0) {
    actions.push({ type: "ADD_COLLECTION_VALUE", input: { collection, values } });
  }
  if (proceed) actions.push({ type: "PROCEED", input: {} });
  return actions;
}
