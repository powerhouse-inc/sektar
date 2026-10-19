import type { ExpenseReportItemsOperations } from "document-models/expense-report/v1";
import {
  InvalidAmountError,
  ItemNotFoundError,
  ReportLockedError,
} from "../../gen/items/error.js";

export const expenseReportItemsOperations: ExpenseReportItemsOperations = {
  setReportDetailsOperation(state, action) {
    if (state.status !== "DRAFT" && state.status !== "REJECTED")
      throw new ReportLockedError("The report is submitted");
    if (action.input.title !== undefined) state.title = action.input.title;
    if (action.input.submitterName !== undefined)
      state.submitter.name = action.input.submitterName;
    if (action.input.submitterEmail !== undefined)
      state.submitter.email = action.input.submitterEmail;
    if (action.input.currency !== undefined && action.input.currency !== null)
      state.currency = action.input.currency;
  },
  addItemOperation(state, action) {
    if (state.status !== "DRAFT" && state.status !== "REJECTED")
      throw new ReportLockedError("The report is submitted");
    if (action.input.amount <= 0)
      throw new InvalidAmountError("An expense must be positive");
    state.items.push({
      id: action.input.id,
      spentAt: action.input.spentAt,
      merchant: action.input.merchant,
      category: action.input.category,
      amount: action.input.amount,
      vatAmount: action.input.vatAmount ?? 0,
      paidWith: action.input.paidWith,
      receiptName: action.input.receiptName || null,
      note: action.input.note || null,
      contactId: action.input.contactId || null,
    });
  },
  updateItemOperation(state, action) {
    if (state.status !== "DRAFT" && state.status !== "REJECTED")
      throw new ReportLockedError("The report is submitted");
    const item = state.items.find((it) => it.id === action.input.id);
    if (!item) throw new ItemNotFoundError(`Item ${action.input.id} not found`);
    const i = action.input;
    if (i.amount !== undefined && i.amount !== null) {
      if (i.amount <= 0)
        throw new InvalidAmountError("An expense must be positive");
      item.amount = i.amount;
    }
    if (i.spentAt !== undefined && i.spentAt !== null) item.spentAt = i.spentAt;
    if (i.merchant !== undefined && i.merchant !== null)
      item.merchant = i.merchant;
    if (i.category !== undefined && i.category !== null)
      item.category = i.category;
    if (i.vatAmount !== undefined && i.vatAmount !== null)
      item.vatAmount = i.vatAmount;
    if (i.paidWith !== undefined && i.paidWith !== null)
      item.paidWith = i.paidWith;
    if (i.receiptName !== undefined) item.receiptName = i.receiptName;
    if (i.note !== undefined) item.note = i.note;
    if (i.contactId !== undefined) item.contactId = i.contactId;
  },
  removeItemOperation(state, action) {
    if (state.status !== "DRAFT" && state.status !== "REJECTED")
      throw new ReportLockedError("The report is submitted");
    const index = state.items.findIndex((it) => it.id === action.input.id);
    if (index === -1)
      throw new ItemNotFoundError(`Item ${action.input.id} not found`);
    state.items.splice(index, 1);
  },
};
