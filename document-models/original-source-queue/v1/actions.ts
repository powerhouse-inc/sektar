/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { baseActions } from "document-model";
import {
  originalSourceQueueAdvanceActions,
  originalSourceQueueCollectionsActions,
  originalSourceQueueDefinitionActions,
  originalSourceQueueErrorsActions,
  originalSourceQueueLifecycleActions,
  originalSourceQueueMemoryActions,
  originalSourceQueueMetaActions,
} from "./gen/creators.js";

/** Actions for the OriginalSourceQueue document model */

export const actions = {
  ...baseActions,
  ...originalSourceQueueDefinitionActions,
  ...originalSourceQueueLifecycleActions,
  ...originalSourceQueueAdvanceActions,
  ...originalSourceQueueCollectionsActions,
  ...originalSourceQueueErrorsActions,
  ...originalSourceQueueMemoryActions,
  ...originalSourceQueueMetaActions,
};
