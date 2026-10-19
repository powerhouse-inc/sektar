/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { PHBaseState, PHDocument } from "document-model";
import type { EmailAction } from "./actions.js";
import type { EmailState as EmailGlobalState } from "./schema/types.js";

type EmailLocalState = Record<PropertyKey, never>;

type EmailPHState = PHBaseState & {
  global: EmailGlobalState;
  local: EmailLocalState;
};
type EmailDocument = PHDocument<EmailPHState>;

export * from "./schema/types.js";

export type {
  EmailAction,
  EmailDocument,
  EmailGlobalState,
  EmailLocalState,
  EmailPHState,
};
