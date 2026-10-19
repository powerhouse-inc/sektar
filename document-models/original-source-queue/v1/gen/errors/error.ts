export type ErrorCode =
  | "ReportErrorNotInProgressError"
  | "ReportErrorIdTakenError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class ReportErrorNotInProgressError
  extends Error
  implements ReducerError
{
  errorCode = "ReportErrorNotInProgressError" as ErrorCode;
  constructor(message = "ReportErrorNotInProgressError") {
    super(message);
  }
}

export class ReportErrorIdTakenError extends Error implements ReducerError {
  errorCode = "ReportErrorIdTakenError" as ErrorCode;
  constructor(message = "ReportErrorIdTakenError") {
    super(message);
  }
}

export const errors = {
  ReportError: { ReportErrorNotInProgressError, ReportErrorIdTakenError },
};
