/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { TripAction } from "./actions.js";
import type { TripState as TripGlobalState } from "./schema/types.js";

type TripLocalState = Record<PropertyKey, never>;

type TripPHState = PHBaseState & {
  global: TripGlobalState;
  local: TripLocalState;
};
type TripDocument = PHDocument<TripPHState>;

export * from "./schema/types.js";

export type {
  TripAction,
  TripDocument,
  TripGlobalState,
  TripLocalState,
  TripPHState,
};
