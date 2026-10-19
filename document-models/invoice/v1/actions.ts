/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { baseActions } from "document-model";
import {
  invoiceDetailsActions,
  invoiceLifecycleActions,
  invoiceLinesActions,
} from "./gen/creators.js";

/** Actions for the Invoice document model */

export const actions = {
  ...baseActions,
  ...invoiceDetailsActions,
  ...invoiceLinesActions,
  ...invoiceLifecycleActions,
};
