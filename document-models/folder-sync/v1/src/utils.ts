import type { FolderSyncFromDisk, FolderSyncPull, FolderSyncState } from "document-models/folder-sync/v1";

/**
 * Fills in what state written before reverse sync lacks: the fromDisk
 * option, the pull list, and the placeholders/pulled counts of older runs.
 * Every operation calls it first, so such a mapping is whole again after
 * its next operation. The schema keeps these fields optional all the same:
 * the stored initialState of such a mapping never gets them.
 */
export function normalize(state: FolderSyncState): { fromDisk: FolderSyncFromDisk; pulls: FolderSyncPull[] } {
  const fromDisk = (state.options.fromDisk ??= "OFF");
  const pulls = (state.pulls ??= []);
  for (const run of state.runs) {
    run.placeholders ??= 0;
    run.pulled ??= 0;
  }
  return { fromDisk, pulls };
}
