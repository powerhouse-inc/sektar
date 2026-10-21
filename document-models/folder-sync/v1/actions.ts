/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { baseActions } from "document-model";
import {
  folderSyncMappingActions,
  folderSyncRunnerActions,
  folderSyncSyncActions,
} from "./gen/creators.js";

/** Actions for the FolderSync document model */

export const actions = {
  ...baseActions,
  ...folderSyncMappingActions,
  ...folderSyncSyncActions,
  ...folderSyncRunnerActions,
};
