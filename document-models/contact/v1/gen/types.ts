/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { ContactAction } from "./actions.js";
import type { ContactState as ContactGlobalState } from "./schema/types.js";

type ContactLocalState = Record<PropertyKey, never>;

type ContactPHState = PHBaseState & {
  global: ContactGlobalState;
  local: ContactLocalState;
};
type ContactDocument = PHDocument<ContactPHState>;

export * from "./schema/types.js";

export type {
  ContactAction,
  ContactDocument,
  ContactGlobalState,
  ContactLocalState,
  ContactPHState,
};
