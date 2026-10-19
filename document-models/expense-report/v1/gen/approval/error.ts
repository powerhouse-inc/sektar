export type ErrorCode =
  | "ReportLockedError"
  | "NoItemsError"
  | "ReportNotSubmittedError"
  | "ReportNotApprovedError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class ReportLockedError extends Error implements ReducerError {
  errorCode = "ReportLockedError" as ErrorCode;
  constructor(message = "ReportLockedError") {
    super(message);
  }
}

export class NoItemsError extends Error implements ReducerError {
  errorCode = "NoItemsError" as ErrorCode;
  constructor(message = "NoItemsError") {
    super(message);
  }
}

export class ReportNotSubmittedError extends Error implements ReducerError {
  errorCode = "ReportNotSubmittedError" as ErrorCode;
  constructor(message = "ReportNotSubmittedError") {
    super(message);
  }
}

export class ReportNotApprovedError extends Error implements ReducerError {
  errorCode = "ReportNotApprovedError" as ErrorCode;
  constructor(message = "ReportNotApprovedError") {
    super(message);
  }
}

export const errors = {
  SubmitReport: { ReportLockedError, NoItemsError },

  ApproveReport: { ReportNotSubmittedError },

  RejectReport: { ReportNotSubmittedError },

  ReimburseReport: { ReportNotApprovedError },
};
