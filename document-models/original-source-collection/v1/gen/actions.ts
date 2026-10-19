/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { OriginalSourceCollectionCaptureAction } from "./capture/actions.js";
import type { OriginalSourceCollectionClassifyAction } from "./classify/actions.js";
import type { OriginalSourceCollectionCollectionAction } from "./collection/actions.js";
import type { OriginalSourceCollectionIdentityAction } from "./identity/actions.js";
import type { OriginalSourceCollectionTasksAction } from "./tasks/actions.js";

export * from "./capture/actions.js";
export * from "./classify/actions.js";
export * from "./collection/actions.js";
export * from "./identity/actions.js";
export * from "./tasks/actions.js";

export type OriginalSourceCollectionAction =
  | OriginalSourceCollectionCollectionAction
  | OriginalSourceCollectionCaptureAction
  | OriginalSourceCollectionIdentityAction
  | OriginalSourceCollectionClassifyAction
  | OriginalSourceCollectionTasksAction;
