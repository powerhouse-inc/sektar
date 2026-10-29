export type ErrorCode =
  | "ProceedNotInProgressError"
  | "ProceedStaleError"
  | "ProceedWithErrorNotInProgressError"
  | "ProceedWithErrorIdTakenError"
  | "ProceedWithErrorStaleError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class ProceedNotInProgressError extends Error implements ReducerError {
  errorCode = "ProceedNotInProgressError" as ErrorCode;
  constructor(message = "ProceedNotInProgressError") {
    super(message);
  }
}

export class ProceedStaleError extends Error implements ReducerError {
  errorCode = "ProceedStaleError" as ErrorCode;
  constructor(message = "ProceedStaleError") {
    super(message);
  }
}

export class ProceedWithErrorNotInProgressError
  extends Error
  implements ReducerError
{
  errorCode = "ProceedWithErrorNotInProgressError" as ErrorCode;
  constructor(message = "ProceedWithErrorNotInProgressError") {
    super(message);
  }
}

export class ProceedWithErrorIdTakenError
  extends Error
  implements ReducerError
{
  errorCode = "ProceedWithErrorIdTakenError" as ErrorCode;
  constructor(message = "ProceedWithErrorIdTakenError") {
    super(message);
  }
}

export class ProceedWithErrorStaleError extends Error implements ReducerError {
  errorCode = "ProceedWithErrorStaleError" as ErrorCode;
  constructor(message = "ProceedWithErrorStaleError") {
    super(message);
  }
}

export const errors = {
  Proceed: { ProceedNotInProgressError, ProceedStaleError },

  ProceedWithError: {
    ProceedWithErrorNotInProgressError,
    ProceedWithErrorIdTakenError,
    ProceedWithErrorStaleError,
  },
};
