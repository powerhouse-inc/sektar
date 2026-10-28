/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { IntegrationBackfillAction } from "./backfill/actions.js";
import type { IntegrationLifecycleAction } from "./lifecycle/actions.js";
import type { IntegrationLiveAction } from "./live/actions.js";
import type { IntegrationReconcilerAction } from "./reconciler/actions.js";
import type { IntegrationSetupAction } from "./setup/actions.js";

export * from "./backfill/actions.js";
export * from "./lifecycle/actions.js";
export * from "./live/actions.js";
export * from "./reconciler/actions.js";
export * from "./setup/actions.js";

export type IntegrationAction =
  | IntegrationSetupAction
  | IntegrationLiveAction
  | IntegrationBackfillAction
  | IntegrationReconcilerAction
  | IntegrationLifecycleAction;
