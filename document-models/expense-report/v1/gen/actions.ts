/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { ExpenseReportApprovalAction } from "./approval/actions.js";
import type { ExpenseReportItemsAction } from "./items/actions.js";

export * from "./approval/actions.js";
export * from "./items/actions.js";

export type ExpenseReportAction =
  | ExpenseReportItemsAction
  | ExpenseReportApprovalAction;
