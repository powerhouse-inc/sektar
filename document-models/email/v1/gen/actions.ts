/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { EmailAttachmentsAction } from "./attachments/actions.js";
import type { EmailMessageAction } from "./message/actions.js";
import type { EmailTriageAction } from "./triage/actions.js";

export * from "./attachments/actions.js";
export * from "./message/actions.js";
export * from "./triage/actions.js";

export type EmailAction =
  | EmailMessageAction
  | EmailAttachmentsAction
  | EmailTriageAction;
