export type ErrorCode =
  | "ProceedNotInProgressError"
  | "ProceedWithErrorNotInProgressError"
  | "ProceedWithErrorIdTakenError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class ProceedNotInProgressError extends Error implements ReducerError {
  errorCode = "ProceedNotInProgressError" as ErrorCode;
  constructor(message = "ProceedNotInProgressError") {
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

export const errors = {
  Proceed: { ProceedNotInProgressError },

  ProceedWithError: {
    ProceedWithErrorNotInProgressError,
    ProceedWithErrorIdTakenError,
  },
};
