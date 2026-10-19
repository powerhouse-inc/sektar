/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { OriginalSourceQueueAction } from "./actions.js";
import type { OriginalSourceQueueState as OriginalSourceQueueGlobalState } from "./schema/types.js";

type OriginalSourceQueueLocalState = Record<PropertyKey, never>;

type OriginalSourceQueuePHState = PHBaseState & {
  global: OriginalSourceQueueGlobalState;
  local: OriginalSourceQueueLocalState;
};
type OriginalSourceQueueDocument = PHDocument<OriginalSourceQueuePHState>;

export * from "./schema/types.js";

export type {
  OriginalSourceQueueAction,
  OriginalSourceQueueDocument,
  OriginalSourceQueueGlobalState,
  OriginalSourceQueueLocalState,
  OriginalSourceQueuePHState,
};
