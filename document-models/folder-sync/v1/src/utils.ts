import type { FolderSyncFromDisk, FolderSyncPull, FolderSyncState } from "document-models/folder-sync/v1";

/** A mapping's state as it was stored before reverse sync: these fields may be missing. */
type LegacyState = Omit<FolderSyncState, "pulls" | "options" | "runs"> & {
  pulls?: FolderSyncPull[];
  options: Omit<FolderSyncState["options"], "fromDisk"> & { fromDisk?: FolderSyncFromDisk };
  runs: (Omit<FolderSyncState["runs"][number], "placeholders" | "pulled"> & { placeholders?: number; pulled?: number })[];
};

/**
 * Fills in what state written before reverse sync lacks: the fromDisk
 * option, the pull list, and the placeholders/pulled counts of older runs.
 * Every operation calls it first, so such a mapping is whole again after
 * its next operation.
 */
export function normalize(state: FolderSyncState): void {
  const s = state as LegacyState;
  s.options.fromDisk ??= "OFF";
  s.pulls ??= [];
  for (const run of s.runs) {
    run.placeholders ??= 0;
    run.pulled ??= 0;
  }
}
