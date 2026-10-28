/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { IntegrationAction } from "./actions.js";
import type { IntegrationState as IntegrationGlobalState } from "./schema/types.js";

type IntegrationLocalState = Record<PropertyKey, never>;

type IntegrationPHState = PHBaseState & {
  global: IntegrationGlobalState;
  local: IntegrationLocalState;
};
type IntegrationDocument = PHDocument<IntegrationPHState>;

export * from "./schema/types.js";

export type {
  IntegrationAction,
  IntegrationDocument,
  IntegrationGlobalState,
  IntegrationLocalState,
  IntegrationPHState,
};
