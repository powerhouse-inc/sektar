import type { FolderSyncMappingOperations } from "document-models/folder-sync/v1";
import { InvalidLocalPathError } from "../../gen/mapping/error.js";

export const folderSyncMappingOperations: FolderSyncMappingOperations = {
  setTargetOperation(state, action) {
    const i = action.input;
    state.driveId = i.driveId;
    state.folderId = i.folderId ?? null;
    state.folderPath = i.folderPath ?? null;
  },
  setLocalPathOperation(state, action) {
    const path = action.input.localPath.trim();
    if (!/^([A-Za-z]:[\\/]|\\\\|\/)/.test(path))
      throw new InvalidLocalPathError(`"${path}" is not an absolute path`);
    state.localPath = path;
  },
  setOptionsOperation(state, action) {
    const i = action.input;
    const o = state.options;
    if (i.trigger) o.trigger = i.trigger;
    if (i.includeSubfolders !== undefined && i.includeSubfolders !== null)
      o.includeSubfolders = i.includeSubfolders;
    if (i.content) o.content = i.content;
    if (i.otherDocuments) o.otherDocuments = i.otherDocuments;
    if (i.onRemoved) o.onRemoved = i.onRemoved;
    if (i.onConflict) o.onConflict = i.onConflict;
  },
  setEnabledOperation(state, action) {
    state.enabled = action.input.enabled;
  },
};
