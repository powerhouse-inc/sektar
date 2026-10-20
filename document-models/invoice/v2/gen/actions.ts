/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { InvoiceAttachmentsAction } from "./attachments/actions.js";
import type { InvoiceCurrencyAction } from "./currency/actions.js";
import type { InvoiceHeaderAction } from "./header/actions.js";
import type { InvoiceLifecycleAction } from "./lifecycle/actions.js";
import type { InvoiceLinesAction } from "./lines/actions.js";
import type { InvoicePartiesAction } from "./parties/actions.js";
import type { InvoicePaymentAction } from "./payment/actions.js";
import type { InvoiceVatAction } from "./vat/actions.js";

export * from "./attachments/actions.js";
export * from "./currency/actions.js";
export * from "./header/actions.js";
export * from "./lifecycle/actions.js";
export * from "./lines/actions.js";
export * from "./parties/actions.js";
export * from "./payment/actions.js";
export * from "./vat/actions.js";

export type InvoiceAction =
  | InvoiceHeaderAction
  | InvoicePartiesAction
  | InvoiceCurrencyAction
  | InvoiceLinesAction
  | InvoiceVatAction
  | InvoicePaymentAction
  | InvoiceAttachmentsAction
  | InvoiceLifecycleAction;
