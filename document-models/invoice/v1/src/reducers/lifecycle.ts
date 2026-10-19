import type { InvoiceLifecycleOperations } from "document-models/invoice/v1";
import {
  InvalidPaymentError,
  InvoiceNotDraftError,
  InvoiceNotOpenError,
  InvoicePaidError,
  InvoiceVoidError,
  NoLinesError,
} from "../../gen/lifecycle/error.js";

export const invoiceLifecycleOperations: InvoiceLifecycleOperations = {
  issueInvoiceOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError("Only a draft can be issued");
    if (state.lines.length === 0)
      throw new NoLinesError("An invoice needs at least one line");
    state.number = action.input.number;
    state.issuedAt = action.input.issuedAt;
    state.dueAt = action.input.dueAt;
    state.status = "OPEN";
  },
  recordPaymentOperation(state, action) {
    if (state.status !== "OPEN")
      throw new InvoiceNotOpenError("Payments apply to open invoices only");
    if (action.input.amount <= 0)
      throw new InvalidPaymentError("A payment must be positive");
    state.payments.push({
      id: action.input.id,
      paidAt: action.input.paidAt,
      amount: action.input.amount,
      method: action.input.method,
      transactionId: action.input.transactionId || null,
    });
    const total = state.lines.reduce(
      (sum, l) => sum + l.quantity * l.unitPrice * (1 + l.vatRate / 100),
      0,
    );
    const paid = state.payments.reduce((sum, p) => sum + p.amount, 0);
    if (paid >= total - 0.005) state.status = "PAID";
  },
  voidInvoiceOperation(state, action) {
    if (state.status === "PAID")
      throw new InvoicePaidError("A paid invoice cannot be voided");
    if (state.status === "VOID")
      throw new InvoiceVoidError("The invoice is already void");
    state.status = "VOID";
    state.voidReason = action.input.reason;
  },
};
