/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { InvoiceDetailsAction } from "./details/actions.js";
import type { InvoiceLifecycleAction } from "./lifecycle/actions.js";
import type { InvoiceLinesAction } from "./lines/actions.js";

export * from "./details/actions.js";
export * from "./lifecycle/actions.js";
export * from "./lines/actions.js";

export type InvoiceAction =
  | InvoiceDetailsAction
  | InvoiceLinesAction
  | InvoiceLifecycleAction;
