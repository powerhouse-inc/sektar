/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { Action } from "document-model";
import type {
  ApproveReportInput,
  ReimburseReportInput,
  RejectReportInput,
  SubmitReportInput,
} from "../types.js";

export type SubmitReportAction = Action & {
  type: "SUBMIT_REPORT";
  input: SubmitReportInput;
};
export type ApproveReportAction = Action & {
  type: "APPROVE_REPORT";
  input: ApproveReportInput;
};
export type RejectReportAction = Action & {
  type: "REJECT_REPORT";
  input: RejectReportInput;
};
export type ReimburseReportAction = Action & {
  type: "REIMBURSE_REPORT";
  input: ReimburseReportInput;
};

export type ExpenseReportApprovalAction =
  | SubmitReportAction
  | ApproveReportAction
  | RejectReportAction
  | ReimburseReportAction;
