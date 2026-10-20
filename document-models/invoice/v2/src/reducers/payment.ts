import type { InvoicePaymentOperations } from "document-models/invoice/v2";
import { InvoiceNotDraftError } from "../../gen/payment/error.js";
import { code, text } from "../rules.js";

export const invoicePaymentOperations: InvoicePaymentOperations = {
  setPaymentInstructionsOperation(state, action) {
    const i = action.input;
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError(
        "Payment instructions are fixed once the invoice is issued",
      );
    const p = state.paymentInstructions;
    if (i.meansCode !== undefined) p.meansCode = code(i.meansCode);
    if (i.meansText !== undefined) p.meansText = text(i.meansText);
    // An IBAN reads in groups of four but is stored without spaces; any other account stays as given.
    if (i.account !== undefined) {
      const account = text(i.account);
      p.account =
        account && /^[A-Z]{2}\d{2}[A-Z0-9 ]+$/i.test(account)
          ? account.replace(/\s+/g, "").toUpperCase()
          : account;
    }
    if (i.accountName !== undefined) p.accountName = text(i.accountName);
    if (i.bic !== undefined) p.bic = code(i.bic);
    if (i.remittance !== undefined) p.remittance = text(i.remittance);
  },
};
