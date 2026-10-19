/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { type SignalDispatch } from "document-model";
import type { ExpenseReportGlobalState } from "../types.js";
import type {
  ApproveReportAction,
  ReimburseReportAction,
  RejectReportAction,
  SubmitReportAction,
} from "./actions.js";

export interface ExpenseReportApprovalOperations {
  submitReportOperation: (
    state: ExpenseReportGlobalState,
    action: SubmitReportAction,
    dispatch?: SignalDispatch,
  ) => void;
  approveReportOperation: (
    state: ExpenseReportGlobalState,
    action: ApproveReportAction,
    dispatch?: SignalDispatch,
  ) => void;
  rejectReportOperation: (
    state: ExpenseReportGlobalState,
    action: RejectReportAction,
    dispatch?: SignalDispatch,
  ) => void;
  reimburseReportOperation: (
    state: ExpenseReportGlobalState,
    action: ReimburseReportAction,
    dispatch?: SignalDispatch,
  ) => void;
}
