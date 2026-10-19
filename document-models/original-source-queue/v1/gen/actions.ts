/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { OriginalSourceQueueAdvanceAction } from "./advance/actions.js";
import type { OriginalSourceQueueCollectionsAction } from "./collections/actions.js";
import type { OriginalSourceQueueDefinitionAction } from "./definition/actions.js";
import type { OriginalSourceQueueErrorsAction } from "./errors/actions.js";
import type { OriginalSourceQueueLifecycleAction } from "./lifecycle/actions.js";
import type { OriginalSourceQueueMemoryAction } from "./memory/actions.js";
import type { OriginalSourceQueueMetaAction } from "./meta/actions.js";

export * from "./advance/actions.js";
export * from "./collections/actions.js";
export * from "./definition/actions.js";
export * from "./errors/actions.js";
export * from "./lifecycle/actions.js";
export * from "./memory/actions.js";
export * from "./meta/actions.js";

export type OriginalSourceQueueAction =
  | OriginalSourceQueueDefinitionAction
  | OriginalSourceQueueLifecycleAction
  | OriginalSourceQueueAdvanceAction
  | OriginalSourceQueueCollectionsAction
  | OriginalSourceQueueErrorsAction
  | OriginalSourceQueueMemoryAction
  | OriginalSourceQueueMetaAction;
