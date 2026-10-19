/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  AddItemInput,
  RemoveItemInput,
  SetReportDetailsInput,
  UpdateItemInput,
} from "../types.js";

export type SetReportDetailsAction = Action & {
  type: "SET_REPORT_DETAILS";
  input: SetReportDetailsInput;
};
export type AddItemAction = Action & { type: "ADD_ITEM"; input: AddItemInput };
export type UpdateItemAction = Action & {
  type: "UPDATE_ITEM";
  input: UpdateItemInput;
};
export type RemoveItemAction = Action & {
  type: "REMOVE_ITEM";
  input: RemoveItemInput;
};

export type ExpenseReportItemsAction =
  | SetReportDetailsAction
  | AddItemAction
  | UpdateItemAction
  | RemoveItemAction;
