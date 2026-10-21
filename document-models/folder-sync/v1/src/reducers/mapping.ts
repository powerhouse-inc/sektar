import type { FolderSyncMappingOperations } from "document-models/folder-sync/v1";
import { InvalidLocalPathError } from "../../gen/mapping/error.js";
import { normalize } from "../utils.js";

export const folderSyncMappingOperations: FolderSyncMappingOperations = {
  setTargetOperation(state, action) {
    normalize(state);
    const i = action.input;
    state.driveId = i.driveId;
    state.folderId = i.folderId ?? null;
    state.folderPath = i.folderPath ?? null;
  },
  setLocalPathOperation(state, action) {
    normalize(state);
    const path = action.input.localPath.trim();
    if (!/^([A-Za-z]:[\\/]|\\\\|\/)/.test(path))
      throw new InvalidLocalPathError(`"${path}" is not an absolute path`);
    state.localPath = path;
  },
  setOptionsOperation(state, action) {
    normalize(state);
    const i = action.input;
    const o = state.options;
    if (i.trigger) o.trigger = i.trigger;
    if (i.includeSubfolders !== undefined && i.includeSubfolders !== null)
      o.includeSubfolders = i.includeSubfolders;
    if (i.content) o.content = i.content;
    if (i.otherDocuments) o.otherDocuments = i.otherDocuments;
    if (i.onRemoved) o.onRemoved = i.onRemoved;
    if (i.onConflict) o.onConflict = i.onConflict;
    if (i.fromDisk) o.fromDisk = i.fromDisk;
  },
  setEnabledOperation(state, action) {
    normalize(state);
    state.enabled = action.input.enabled;
  },
};
