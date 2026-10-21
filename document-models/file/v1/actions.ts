/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { baseActions } from "document-model";
import {
  fileContentActions,
  fileDiskActions,
  fileRenditionsActions,
  fileTagsActions,
} from "./gen/creators.js";

/** Actions for the File document model */

export const actions = {
  ...baseActions,
  ...fileContentActions,
  ...fileRenditionsActions,
  ...fileTagsActions,
  ...fileDiskActions,
};
