import type { InvoiceDetailsOperations } from "document-models/invoice/v1";
import {
  InvoiceClosedError,
  InvoiceIssuedError,
} from "../../gen/details/error.js";

export const invoiceDetailsOperations: InvoiceDetailsOperations = {
  setInvoiceDetailsOperation(state, action) {
    if (state.status === "PAID" || state.status === "VOID")
      throw new InvoiceClosedError("A paid or void invoice cannot change");
    const i = action.input;
    if (i.direction !== undefined && i.direction !== null) {
      if (state.status !== "DRAFT")
        throw new InvoiceIssuedError(
          "The direction is fixed once the invoice is issued",
        );
      state.direction = i.direction;
    }
    if (i.currency !== undefined && i.currency !== null) {
      if (state.status !== "DRAFT")
        throw new InvoiceIssuedError(
          "The currency is fixed once the invoice is issued",
        );
      state.currency = i.currency;
    }
    if (i.number !== undefined) state.number = i.number;
    if (i.counterpartyName !== undefined)
      state.counterparty.name = i.counterpartyName;
    if (i.contactId !== undefined) state.counterparty.contactId = i.contactId;
    if (i.email !== undefined) state.counterparty.email = i.email;
    if (i.vatId !== undefined) state.counterparty.vatId = i.vatId;
    if (i.address !== undefined) state.counterparty.address = i.address;
    if (i.reference !== undefined) state.reference = i.reference;
    if (i.notes !== undefined) state.notes = i.notes;
    if (i.dueAt !== undefined) state.dueAt = i.dueAt;
  },
};
