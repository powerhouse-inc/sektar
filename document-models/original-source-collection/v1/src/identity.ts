/**
 * Working out which captures are the same object.
 *
 * This is the part of the model that is actually difficult, so it lives here
 * as plain functions over plain shapes — testable without a document, a
 * reducer or a reactor, the same split that made the queue's odometer
 * provable.
 *
 * One rule holds everything up: **an identifier belongs to at most one live
 * source.** Capture resolves by identifier rather than by position, which is
 * what makes re-running a backfill update what it already has instead of
 * duplicating it.
 */

/** The minimum a source has to look like for identity to work on it. */
export interface Identified {
  id: string;
  externalId: string;
  aliases: string[];
  capturedAt: string;
  /** Set when this source has been folded into another. */
  mergedInto?: string | null;
}

/**
 * An identifier must name the system it came from.
 *
 * Without the namespace, `abc123` from Gmail and `abc123` from Toggl are the
 * same key, and two unrelated objects silently become one. Since identifiers
 * are plain strings, this check is the only thing standing between the model
 * and that collision — so it is enforced, not merely recommended.
 */
const NAMESPACED = /^[a-z0-9_-]+:.+/i;

export function isNamespaced(value: string): boolean {
  return NAMESPACED.test(value.trim());
}

/** Everything a source answers to: its canonical id and every alias. */
export function identifiersOf(source: Identified): string[] {
  return [source.externalId, ...source.aliases];
}

export function isMerged(source: Identified): boolean {
  return typeof source.mergedInto === "string" && source.mergedInto !== "";
}

/**
 * Follow a tombstone to the source that is actually live.
 *
 * A folded source keeps its own identifiers, so a capture arriving under an
 * old id still finds it — and must be sent on to whatever it was folded into.
 * The chain is walked rather than assumed to be one deep, because a merge of a
 * merge is a thing a workflow will eventually do. It stops on a cycle instead
 * of hanging: a cycle is a bug elsewhere, and hanging would hide it.
 */
export function liveSource<T extends Identified>(
  sources: T[],
  from: T,
): T {
  const seen = new Set<string>([from.id]);
  let current = from;
  while (isMerged(current)) {
    const next = sources.find((s) => s.id === current.mergedInto);
    if (!next || seen.has(next.id)) return current;
    seen.add(next.id);
    current = next;
  }
  return current;
}

/**
 * Every live source claiming any of these identifiers.
 *
 * More than one answer means the incoming record joins things that were
 * previously believed separate — which is the signal to merge, not an error.
 */
export function claimantsOf<T extends Identified>(
  sources: T[],
  identifiers: string[],
): T[] {
  const wanted = new Set(identifiers.map((value) => value.trim()));
  const found = new Map<string, T>();
  for (const source of sources) {
    if (!identifiersOf(source).some((value) => wanted.has(value))) continue;
    const live = liveSource(sources, source);
    found.set(live.id, live);
  }
  return [...found.values()];
}

/** The single live source answering to an identifier, if any. */
export function claimantOf<T extends Identified>(
  sources: T[],
  identifier: string,
): T | undefined {
  return claimantsOf(sources, [identifier])[0];
}

/**
 * Which of several sources survives a merge.
 *
 * Oldest capture wins, because the earliest sighting is the one other records
 * are most likely to already point at. Ties break on the id, which is
 * arbitrary but *fixed* — a reducer has to give the same answer every time it
 * replays, so "arbitrary" must never mean "whichever came back first".
 */
export function pickWinner<T extends Identified>(candidates: T[]): T {
  return [...candidates].sort((a, b) => {
    const byTime = a.capturedAt.localeCompare(b.capturedAt);
    return byTime === 0 ? a.id.localeCompare(b.id) : byTime;
  })[0];
}

/** Add to a set held as an array, keeping order and dropping blanks. */
export function union(existing: string[], incoming: string[]): string[] {
  const out = [...existing];
  for (const raw of incoming) {
    const value = raw.trim();
    if (value !== "" && !out.includes(value)) out.push(value);
  }
  return out;
}

/**
 * Aliases after taking on more identifiers.
 *
 * A source's canonical id is never also one of its aliases. Every path that
 * adds identifiers goes through here, because the one that did not was the
 * one that duplicated it — a capture under a source's own externalId unioned
 * that id straight back in as an alias.
 */
export function aliasesWith(
  source: Identified,
  incoming: string[],
): string[] {
  return union(source.aliases, incoming).filter(
    (value) => value !== source.externalId,
  );
}

/**
 * The identifiers a winner should take on when folding a loser in.
 *
 * Everything the loser answers to, minus what the winner already has. The
 * loser is NOT stripped — it keeps its own identifiers, which is exactly what
 * makes a split able to work out later what to take back.
 */
export function identifiersToAbsorb(
  winner: Identified,
  loser: Identified,
): string[] {
  const held = new Set(identifiersOf(winner));
  return identifiersOf(loser).filter((value) => !held.has(value));
}

/**
 * The identifiers a split should take back off the winner.
 *
 * Only what this loser still carries, and only where no OTHER source folded
 * into the same winner also carries it — otherwise undoing one merge would
 * quietly break a different one. The winner's own canonical id is never
 * removed.
 */
export function identifiersToReturn(
  sources: Identified[],
  winner: Identified,
  loser: Identified,
): string[] {
  const stillMerged = sources.filter(
    (s) => s.id !== loser.id && s.mergedInto === winner.id,
  );
  const heldByOthers = new Set(stillMerged.flatMap(identifiersOf));
  return identifiersOf(loser).filter(
    (value) => value !== winner.externalId && !heldByOthers.has(value),
  );
}

/**
 * Identifiers claimed by more than one live source.
 *
 * The invariant, as a function. Tests assert it is empty after every
 * operation; if it ever isn't, identifier-based resolution has stopped
 * meaning anything.
 */
export function conflictingIdentifiers(sources: Identified[]): string[] {
  const owner = new Map<string, string>();
  const clashes = new Set<string>();
  for (const source of sources) {
    if (isMerged(source)) continue;
    for (const value of identifiersOf(source)) {
      const already = owner.get(value);
      if (already !== undefined && already !== source.id) clashes.add(value);
      else owner.set(value, source.id);
    }
  }
  return [...clashes];
}
