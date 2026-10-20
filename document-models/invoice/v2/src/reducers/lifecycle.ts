import type { InvoiceLifecycleOperations } from "document-models/invoice/v2";
import {
  InvalidNumberError,
  InvalidPaymentError,
  InvoiceNotDraftError,
  InvoiceNotOpenError,
  InvoicePaidError,
  InvoiceVoidError,
  NoLinesError,
  PaymentNotFoundError,
} from "../../gen/lifecycle/error.js";
import { computeTotals } from "../totals.js";

/** Paid once the payments cover what is due, give or take half a cent. */
const settled = (due: number) => due <= 0.005;

export const invoiceLifecycleOperations: InvoiceLifecycleOperations = {
  issueInvoiceOperation(state, action) {
    const i = action.input;
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError("Only a draft can be issued");
    if (state.lines.length === 0)
      throw new NoLinesError("An invoice needs at least one line");
    const number = i.number.trim();
    if (!number)
      throw new InvalidNumberError("An issued invoice needs a number");
    state.number = number;
    state.issuedAt = i.issuedAt;
    if (i.dueAt !== undefined && i.dueAt !== null) state.dueAt = i.dueAt;
    state.status = "OPEN";
  },
  recordPaymentOperation(state, action) {
    const i = action.input;
    if (state.status !== "OPEN")
      throw new InvoiceNotOpenError("Payments apply to open invoices only");
    if (!Number.isFinite(i.amount) || i.amount <= 0)
      throw new InvalidPaymentError("A payment must be positive");
    if (state.payments.some((p) => p.id === i.id))
      throw new InvalidPaymentError("The payment id is already used");
    state.payments.push({
      id: i.id,
      paidAt: i.paidAt,
      amount: i.amount,
      method: i.method,
      transactionId: i.transactionId?.trim() || null,
    });
    if (settled(computeTotals(state).due)) state.status = "PAID";
  },
  removePaymentOperation(state, action) {
    if (state.status === "VOID")
      throw new InvoiceVoidError("The invoice is void");
    const index = state.payments.findIndex((p) => p.id === action.input.id);
    if (index < 0) throw new PaymentNotFoundError("No such payment");
    state.payments.splice(index, 1);
    if (state.status === "PAID" && !settled(computeTotals(state).due))
      state.status = "OPEN";
  },
  voidInvoiceOperation(state, action) {
    if (state.status === "PAID")
      throw new InvoicePaidError("A paid invoice cannot be voided");
    if (state.status === "VOID")
      throw new InvoiceVoidError("The invoice is already void");
    state.status = "VOID";
    state.voidReason = action.input.reason.trim() || null;
  },
};
