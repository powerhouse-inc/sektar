/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { baseActions } from "document-model";
import {
  invoiceAttachmentsActions,
  invoiceCurrencyActions,
  invoiceHeaderActions,
  invoiceLifecycleActions,
  invoiceLinesActions,
  invoicePartiesActions,
  invoicePaymentActions,
  invoiceVatActions,
} from "./gen/creators.js";

/** Actions for the Invoice document model */

export const actions = {
  ...baseActions,
  ...invoiceHeaderActions,
  ...invoicePartiesActions,
  ...invoiceCurrencyActions,
  ...invoiceLinesActions,
  ...invoiceVatActions,
  ...invoicePaymentActions,
  ...invoiceAttachmentsActions,
  ...invoiceLifecycleActions,
};
