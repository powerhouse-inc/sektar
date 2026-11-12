/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { CurrencyPairAction } from "./actions.js";
import type { CurrencyPairState as CurrencyPairGlobalState } from "./schema/types.js";

type CurrencyPairLocalState = Record<PropertyKey, never>;

type CurrencyPairPHState = PHBaseState & {
  global: CurrencyPairGlobalState;
  local: CurrencyPairLocalState;
};
type CurrencyPairDocument = PHDocument<CurrencyPairPHState>;

export * from "./schema/types.js";

export type {
  CurrencyPairAction,
  CurrencyPairDocument,
  CurrencyPairGlobalState,
  CurrencyPairLocalState,
  CurrencyPairPHState,
};
