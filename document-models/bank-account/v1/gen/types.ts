/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { BankAccountAction } from "./actions.js";
import type { BankAccountState as BankAccountGlobalState } from "./schema/types.js";

type BankAccountLocalState = Record<PropertyKey, never>;

type BankAccountPHState = PHBaseState & {
  global: BankAccountGlobalState;
  local: BankAccountLocalState;
};
type BankAccountDocument = PHDocument<BankAccountPHState>;

export * from "./schema/types.js";

export type {
  BankAccountAction,
  BankAccountDocument,
  BankAccountGlobalState,
  BankAccountLocalState,
  BankAccountPHState,
};
