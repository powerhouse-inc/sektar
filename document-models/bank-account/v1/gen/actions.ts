/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { BankAccountAccountAction } from "./account/actions.js";
import type { BankAccountFeedAction } from "./feed/actions.js";

export * from "./account/actions.js";
export * from "./feed/actions.js";

export type BankAccountAction =
  | BankAccountAccountAction
  | BankAccountFeedAction;
