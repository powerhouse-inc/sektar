import type { FolderSyncSyncOperations } from "document-models/folder-sync/v1";
import {
  MappingDisabledError,
  NotConfiguredError,
} from "../../gen/sync/error.js";

export const folderSyncSyncOperations: FolderSyncSyncOperations = {
  requestSyncOperation(state, action) {
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
};
