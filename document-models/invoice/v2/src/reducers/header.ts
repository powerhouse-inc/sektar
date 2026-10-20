import type { InvoiceHeaderOperations } from "document-models/invoice/v2";
import {
  DuplicateReferenceError,
  InvalidPeriodError,
  InvoiceClosedError,
  InvoiceNotDraftError,
  ReferenceNotFoundError,
} from "../../gen/header/error.js";
import { text } from "../rules.js";

/** Fields that stay editable once an invoice is issued: they arrange payment, not what was invoiced. */
const AFTER_ISSUE = new Set(["dueAt", "paymentTerms", "notes"]);

export const invoiceHeaderOperations: InvoiceHeaderOperations = {
  setHeaderOperation(state, action) {
    const i = action.input;
    if (state.status === "PAID" || state.status === "VOID")
      throw new InvoiceClosedError("A paid or void invoice cannot change");
    if (state.status === "OPEN") {
      const fixed = Object.entries(i).find(
        ([key, value]) => value !== undefined && !AFTER_ISSUE.has(key),
      );
      if (fixed)
        throw new InvoiceNotDraftError(
          `The ${fixed[0]} is fixed once the invoice is issued`,
        );
    }
    const start =
      i.periodStart !== undefined
        ? i.periodStart
        : (state.period?.start ?? null);
    const end =
      i.periodEnd !== undefined ? i.periodEnd : (state.period?.end ?? null);
    if (start && end && end < start)
      throw new InvalidPeriodError("The period ends before it starts");

    if (i.kind) state.kind = i.kind;
    if (i.direction) state.direction = i.direction;
    if (i.subject !== undefined) state.subject = text(i.subject);
    if (i.dueAt !== undefined) state.dueAt = i.dueAt ?? null;
    if (i.deliveredAt !== undefined) state.deliveredAt = i.deliveredAt ?? null;
    if (i.periodStart !== undefined || i.periodEnd !== undefined)
      state.period = start || end ? { start, end } : null;
    if (i.paymentTerms !== undefined) state.paymentTerms = text(i.paymentTerms);
    if (i.notes !== undefined) state.notes = text(i.notes);
    if (i.buyerReference !== undefined)
      state.references.buyerReference = text(i.buyerReference);
    if (i.orderReference !== undefined)
      state.references.orderReference = text(i.orderReference);
    if (i.contractReference !== undefined)
      state.references.contractReference = text(i.contractReference);
    if (i.projectReference !== undefined)
      state.references.projectReference = text(i.projectReference);
    if (i.roundingAmount !== undefined)
      state.roundingAmount =
        i.roundingAmount === 0 ? null : (i.roundingAmount ?? null);
  },
  addPrecedingInvoiceOperation(state, action) {
    const i = action.input;
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError(
        "References are fixed once the invoice is issued",
      );
    if (state.precedingInvoices.some((p) => p.id === i.id))
      throw new DuplicateReferenceError("The id is already used");
    state.precedingInvoices.push({
      id: i.id,
      number: i.number.trim(),
      issuedAt: i.issuedAt ?? null,
      documentId: i.documentId ?? null,
    });
  },
  removePrecedingInvoiceOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError(
        "References are fixed once the invoice is issued",
      );
    const index = state.precedingInvoices.findIndex(
      (p) => p.id === action.input.id,
    );
    if (index < 0) throw new ReferenceNotFoundError("No such reference");
    state.precedingInvoices.splice(index, 1);
  },
};
