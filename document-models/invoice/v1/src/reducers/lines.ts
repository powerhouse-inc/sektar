import type { InvoiceLinesOperations } from "document-models/invoice/v1";
import {
  InvalidLineError,
  InvoiceNotDraftError,
  LineNotFoundError,
} from "../../gen/lines/error.js";

export const invoiceLinesOperations: InvoiceLinesOperations = {
  addLineOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError("Lines can only change on a draft");
    if (action.input.quantity <= 0)
      throw new InvalidLineError("Quantity must be positive");
    state.lines.push({
      id: action.input.id,
      description: action.input.description,
      quantity: action.input.quantity,
      unitPrice: action.input.unitPrice,
      vatRate: action.input.vatRate,
    });
  },
  updateLineOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError("Lines can only change on a draft");
    const line = state.lines.find((l) => l.id === action.input.id);
    if (!line) throw new LineNotFoundError(`Line ${action.input.id} not found`);
    if (action.input.quantity !== undefined && action.input.quantity !== null) {
      if (action.input.quantity <= 0)
        throw new InvalidLineError("Quantity must be positive");
      line.quantity = action.input.quantity;
    }
    if (
      action.input.description !== undefined &&
      action.input.description !== null
    )
      line.description = action.input.description;
    if (action.input.unitPrice !== undefined && action.input.unitPrice !== null)
      line.unitPrice = action.input.unitPrice;
    if (action.input.vatRate !== undefined && action.input.vatRate !== null)
      line.vatRate = action.input.vatRate;
  },
  removeLineOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError("Lines can only change on a draft");
    const index = state.lines.findIndex((l) => l.id === action.input.id);
    if (index === -1)
      throw new LineNotFoundError(`Line ${action.input.id} not found`);
    state.lines.splice(index, 1);
  },
};
