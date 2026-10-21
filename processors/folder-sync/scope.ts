// Which drive changes concern which automatic mapping: a change below the
// mapped folder runs it, a change elsewhere in the drive does not. Pure, so
// the processor's choice of what to run is tested without a reactor.
import type { OperationWithContext } from "document-model";

export interface ScopeNode {
  id: string;
  parentFolder?: string | null;
}

export interface ScopeMapping {
  /** The mapped folder; null maps the drive's root */
  folderId: string | null;
  includeSubfolders: boolean;
}

/** Operations this much older than the processor are a replay of history, not a change. */
export const REPLAY_MARGIN_MS = 60_000;

/**
 * The nodes a batch of operations changed in a drive: the Files that changed
 * themselves, and the nodes (and folders) the drive's own operations name.
 * Operations from before `since` (a replay after a restart) change nothing.
 */
export function changedNodes(
  operations: readonly OperationWithContext[],
  driveId: string,
  types: { file: string; drive: string },
  since: number,
): Set<string> {
  const ids = new Set<string>();
  for (const { operation, context } of operations) {
    if (context.scope !== "global") continue;
    const at = Date.parse(operation.timestampUtcMs);
    if (Number.isFinite(at) && at < since - REPLAY_MARGIN_MS) continue;
    if (context.documentType === types.file) {
      ids.add(context.documentId);
    } else if (context.documentType === types.drive && context.documentId === driveId) {
      const input = (operation.action.input ?? {}) as Record<string, unknown>;
      for (const key of ["id", "srcFolder", "targetParentFolder", "parentFolder"]) {
        const v = input[key];
        if (typeof v === "string" && v) ids.add(v);
      }
    }
  }
  return ids;
}

/**
 * Whether any of the changed nodes is in what the mapping copies. A node the
 * drive no longer knows (deleted, or not there yet) might have been: it counts.
 */
export function inScope(changed: ReadonlySet<string>, nodes: readonly ScopeNode[], m: ScopeMapping): boolean {
  if (changed.size === 0) return false;
  if (m.folderId === null && m.includeSubfolders) return true;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const id of changed) {
    if (id === m.folderId) return true;
    const node = byId.get(id);
    if (!node) return true;
    if (!m.includeSubfolders) {
      if ((node.parentFolder ?? null) === m.folderId) return true;
      continue;
    }
    const seen = new Set<string>();
    for (let at = node.parentFolder ?? null; at !== null && !seen.has(at); at = byId.get(at)?.parentFolder ?? null) {
      if (at === m.folderId) return true;
      seen.add(at);
    }
  }
  return false;
}
