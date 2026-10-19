/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { OriginalSourceCollectionAction } from "./actions.js";
import type { OriginalSourceCollectionState as OriginalSourceCollectionGlobalState } from "./schema/types.js";

type OriginalSourceCollectionLocalState = Record<PropertyKey, never>;

type OriginalSourceCollectionPHState = PHBaseState & {
  global: OriginalSourceCollectionGlobalState;
  local: OriginalSourceCollectionLocalState;
};
type OriginalSourceCollectionDocument =
  PHDocument<OriginalSourceCollectionPHState>;

export * from "./schema/types.js";

export type {
  OriginalSourceCollectionAction,
  OriginalSourceCollectionDocument,
  OriginalSourceCollectionGlobalState,
  OriginalSourceCollectionLocalState,
  OriginalSourceCollectionPHState,
};
