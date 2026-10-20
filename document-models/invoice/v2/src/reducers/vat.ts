import type { InvoiceVatOperations } from "document-models/invoice/v2";
import {
  InvalidVatReasonError,
  InvoiceNotDraftError,
  VatReasonNotFoundError,
} from "../../gen/vat/error.js";
import { code, text } from "../rules.js";
import { CATEGORY_NEEDS_REASON } from "../totals.js";

export const invoiceVatOperations: InvoiceVatOperations = {
  setVatReasonOperation(state, action) {
    const i = action.input;
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError(
        "VAT reasons are fixed once the invoice is issued",
      );
    if (!CATEGORY_NEEDS_REASON[i.category])
      throw new InvalidVatReasonError(
        "Standard and zero-rated VAT take no exemption reason",
      );
    const reasonCode = code(i.code);
    const reasonText = text(i.text);
    if (!reasonCode && !reasonText)
      throw new InvalidVatReasonError(
        "A reason needs a VATEX code or the legal mention",
      );
    const reason = { category: i.category, code: reasonCode, text: reasonText };
    const index = state.vatReasons.findIndex((r) => r.category === i.category);
    if (index >= 0) state.vatReasons[index] = reason;
    else state.vatReasons.push(reason);
  },
  removeVatReasonOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError(
        "VAT reasons are fixed once the invoice is issued",
      );
    const index = state.vatReasons.findIndex(
      (r) => r.category === action.input.category,
    );
    if (index < 0)
      throw new VatReasonNotFoundError("No reason for that category");
    state.vatReasons.splice(index, 1);
  },
};
