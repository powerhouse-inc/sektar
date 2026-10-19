import type { ExpenseReportApprovalOperations } from "document-models/expense-report/v1";
import {
  NoItemsError,
  ReportLockedError,
  ReportNotApprovedError,
  ReportNotSubmittedError,
} from "../../gen/approval/error.js";

export const expenseReportApprovalOperations: ExpenseReportApprovalOperations =
  {
    submitReportOperation(state, action) {
      if (state.status !== "DRAFT" && state.status !== "REJECTED")
        throw new ReportLockedError("The report is already submitted");
      if (state.items.length === 0)
        throw new NoItemsError("Add at least one expense before submitting");
      state.status = "SUBMITTED";
      state.submittedAt = action.input.submittedAt;
      state.decidedAt = null;
      state.decidedBy = null;
      state.decisionNote = null;
    },
    approveReportOperation(state, action) {
      if (state.status !== "SUBMITTED")
        throw new ReportNotSubmittedError(
          "Only a submitted report can be approved",
        );
      state.status = "APPROVED";
      state.decidedAt = action.input.decidedAt;
      state.decidedBy = action.input.decidedBy;
      state.decisionNote = action.input.note || null;
    },
    rejectReportOperation(state, action) {
      if (state.status !== "SUBMITTED")
        throw new ReportNotSubmittedError(
          "Only a submitted report can be rejected",
        );
      state.status = "REJECTED";
      state.decidedAt = action.input.decidedAt;
      state.decidedBy = action.input.decidedBy;
      state.decisionNote = action.input.note;
    },
    reimburseReportOperation(state, action) {
      if (state.status !== "APPROVED")
        throw new ReportNotApprovedError(
          "Only an approved report can be reimbursed",
        );
      state.status = "REIMBURSED";
      state.reimbursedAt = action.input.reimbursedAt;
      state.reimbursementTransactionId = action.input.transactionId || null;
    },
  };
