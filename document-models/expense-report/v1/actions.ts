/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { baseActions } from "document-model";
import {
  expenseReportApprovalActions,
  expenseReportItemsActions,
} from "./gen/creators.js";

/** Actions for the ExpenseReport document model */

export const actions = {
  ...baseActions,
  ...expenseReportItemsActions,
  ...expenseReportApprovalActions,
};
