import type {
  InvoiceLine,
  InvoiceLinesOperations,
  UpdateLineInput,
} from "document-models/invoice/v2";
import {
  InvalidLineError,
  InvoiceNotDraftError,
  LineNotFoundError,
} from "../../gen/lines/error.js";
import { code, derivePrice, lineProblem, text } from "../rules.js";

/** The line an update would produce, without touching the original. */
function updated(line: InvoiceLine, i: UpdateLineInput): InvoiceLine {
  const next: InvoiceLine = {
    ...line,
    period: line.period ? { ...line.period } : null,
    original: line.original ? { ...line.original } : null,
  };
  if (i.description !== undefined && i.description !== null)
    next.description = i.description.trim();
  if (i.note !== undefined) next.note = text(i.note);
  if (i.quantity !== undefined && i.quantity !== null)
    next.quantity = i.quantity;
  if (i.unitCode !== undefined) next.unitCode = code(i.unitCode) ?? "C62";
  if (i.unitPrice !== undefined && i.unitPrice !== null)
    next.unitPrice = i.unitPrice;
  if (i.vatCategory) next.vatCategory = i.vatCategory;
  if (i.vatRate !== undefined && i.vatRate !== null) next.vatRate = i.vatRate;
  if (i.category !== undefined) next.category = text(i.category);
  if (i.periodStart !== undefined || i.periodEnd !== undefined) {
    const start =
      i.periodStart !== undefined
        ? i.periodStart
        : (next.period?.start ?? null);
    const end =
      i.periodEnd !== undefined ? i.periodEnd : (next.period?.end ?? null);
    next.period = start || end ? { start, end } : null;
  }
  if (i.originalAmount === null) {
    next.original = null;
  } else if (
    i.originalAmount !== undefined ||
    i.originalCurrency !== undefined ||
    i.originalRate !== undefined ||
    i.originalReference !== undefined
  ) {
    const amount = i.originalAmount ?? next.original?.amount;
    const currency =
      i.originalCurrency === undefined
        ? next.original?.currency
        : code(i.originalCurrency);
    const rate =
      i.originalRate !== undefined
        ? i.originalRate
        : (next.original?.rate ?? null);
    const reference =
      i.originalReference !== undefined
        ? text(i.originalReference)
        : (next.original?.reference ?? null);
    if (amount === undefined || !currency)
      throw new InvalidLineError(
        "A forward-billed cost needs an amount and a currency",
      );
    next.original = { amount, currency, rate, reference };
  }
  return next;
}

export const invoiceLinesOperations: InvoiceLinesOperations = {
  addLineOperation(state, action) {
    const i = action.input;
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError("Lines can only change on a draft");
    if (state.lines.some((l) => l.id === i.id))
      throw new InvalidLineError("The line id is already used");
    const amount = i.originalAmount;
    const originalCurrency = code(i.originalCurrency);
    if (amount !== undefined && amount !== null && !originalCurrency)
      throw new InvalidLineError(
        "A forward-billed cost needs an amount and a currency",
      );
    const line: InvoiceLine = {
      id: i.id,
      description: i.description.trim(),
      note: text(i.note),
      quantity: i.quantity,
      unitCode: code(i.unitCode) ?? "C62",
      unitPrice: i.unitPrice,
      vatCategory: i.vatCategory,
      vatRate: i.vatRate,
      category: text(i.category),
      period:
        i.periodStart || i.periodEnd
          ? { start: i.periodStart ?? null, end: i.periodEnd ?? null }
          : null,
      original:
        amount !== undefined && amount !== null && originalCurrency
          ? {
              amount,
              currency: originalCurrency,
              rate: i.originalRate ?? null,
              reference: text(i.originalReference),
            }
          : null,
      attachments: [],
    };
    derivePrice(state, line);
    const problem = lineProblem(line);
    if (problem) throw new InvalidLineError(problem);
    const at =
      i.position === undefined || i.position === null
        ? state.lines.length
        : Math.max(0, Math.min(state.lines.length, i.position));
    state.lines.splice(at, 0, line);
  },
  updateLineOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError("Lines can only change on a draft");
    const index = state.lines.findIndex((l) => l.id === action.input.id);
    if (index < 0) throw new LineNotFoundError("No such line");
    const next = updated(state.lines[index], action.input);
    derivePrice(state, next);
    const problem = lineProblem(next);
    if (problem) throw new InvalidLineError(problem);
    state.lines[index] = next;
  },
  removeLineOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError("Lines can only change on a draft");
    const index = state.lines.findIndex((l) => l.id === action.input.id);
    if (index < 0) throw new LineNotFoundError("No such line");
    state.lines.splice(index, 1);
  },
  moveLineOperation(state, action) {
    if (state.status !== "DRAFT")
      throw new InvoiceNotDraftError("Lines can only change on a draft");
    const index = state.lines.findIndex((l) => l.id === action.input.id);
    if (index < 0) throw new LineNotFoundError("No such line");
    const [line] = state.lines.splice(index, 1);
    const to = Math.max(0, Math.min(state.lines.length, action.input.index));
    state.lines.splice(to, 0, line);
  },
};
