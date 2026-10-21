import { normalize } from "../utils.js";
import type { FolderSyncSyncOperations } from "document-models/folder-sync/v1";
import {
  DuplicatePullIdError,
  FromDiskOffError,
  MappingDisabledError,
  NotConfiguredError,
} from "../../gen/sync/error.js";

export const folderSyncSyncOperations: FolderSyncSyncOperations = {
  requestSyncOperation(state, action) {
    normalize(state);
    const i = action.input;
    if (!state.driveId || !state.localPath)
      throw new NotConfiguredError(
        "Set the drive folder and the local path first",
      );
    if (!state.enabled)
      throw new MappingDisabledError("Enable the mapping first");
    state.request = {
      id: i.id,
      requestedAt: i.requestedAt,
      requestedBy: i.requestedBy ?? null,
      full: i.full ?? false,
    };
    if (state.status !== "RUNNING") state.status = "REQUESTED";
  },
  requestPullOperation(state, action) {
    normalize(state);
    const i = action.input;
    if (!state.driveId || !state.localPath)
      throw new NotConfiguredError(
        "Set the drive folder and the local path first",
      );
    if (!state.enabled)
      throw new MappingDisabledError("Enable the mapping first");
    if (state.options.fromDisk === "OFF")
      throw new FromDiskOffError("Turn on changes from disk first");
    if (state.pulls.some((p) => p.id === i.id))
      throw new DuplicatePullIdError(`Pull ${i.id} exists`);
    state.pulls.push({
      id: i.id,
      requestedAt: i.requestedAt,
      requestedBy: i.requestedBy ?? null,
      nodeIds: [...new Set(i.nodeIds ?? [])],
    });
    if (state.status !== "RUNNING") state.status = "REQUESTED";
  },
};
