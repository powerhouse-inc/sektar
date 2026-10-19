/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { ExpenseReportGlobalState } from "../types.js";
import type {
  AddItemAction,
  RemoveItemAction,
  SetReportDetailsAction,
  UpdateItemAction,
} from "./actions.js";

export interface ExpenseReportItemsOperations {
  setReportDetailsOperation: (
    state: ExpenseReportGlobalState,
    action: SetReportDetailsAction,
    dispatch?: SignalDispatch,
  ) => void;
  addItemOperation: (
    state: ExpenseReportGlobalState,
    action: AddItemAction,
    dispatch?: SignalDispatch,
  ) => void;
  updateItemOperation: (
    state: ExpenseReportGlobalState,
    action: UpdateItemAction,
    dispatch?: SignalDispatch,
  ) => void;
  removeItemOperation: (
    state: ExpenseReportGlobalState,
    action: RemoveItemAction,
    dispatch?: SignalDispatch,
  ) => void;
}
