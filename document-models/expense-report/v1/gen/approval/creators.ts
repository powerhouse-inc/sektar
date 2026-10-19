/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import { createAction } from "document-model";
import {
  ApproveReportInputSchema,
  ReimburseReportInputSchema,
  RejectReportInputSchema,
  SubmitReportInputSchema,
} from "../schema/zod.js";
import type {
  ApproveReportInput,
  ReimburseReportInput,
  RejectReportInput,
  SubmitReportInput,
} from "../types.js";
import type {
  ApproveReportAction,
  ReimburseReportAction,
  RejectReportAction,
  SubmitReportAction,
} from "./actions.js";

export const submitReport = (input: SubmitReportInput) =>
  createAction<SubmitReportAction>(
    "SUBMIT_REPORT",
    { ...input },
    undefined,
    SubmitReportInputSchema,
    "global",
  );

export const approveReport = (input: ApproveReportInput) =>
  createAction<ApproveReportAction>(
    "APPROVE_REPORT",
    { ...input },
    undefined,
    ApproveReportInputSchema,
    "global",
  );

export const rejectReport = (input: RejectReportInput) =>
  createAction<RejectReportAction>(
    "REJECT_REPORT",
    { ...input },
    undefined,
    RejectReportInputSchema,
    "global",
  );

export const reimburseReport = (input: ReimburseReportInput) =>
  createAction<ReimburseReportAction>(
    "REIMBURSE_REPORT",
    { ...input },
    undefined,
    ReimburseReportInputSchema,
    "global",
  );
