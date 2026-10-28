export type ErrorCode =
  | "NotInitializedError"
  | "DuplicateBackfillIdError"
  | "InvalidRangeError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class NotInitializedError extends Error implements ReducerError {
  errorCode = "NotInitializedError" as ErrorCode;
  constructor(message = "NotInitializedError") {
    super(message);
  }
}

export class DuplicateBackfillIdError extends Error implements ReducerError {
  errorCode = "DuplicateBackfillIdError" as ErrorCode;
  constructor(message = "DuplicateBackfillIdError") {
    super(message);
  }
}

export class InvalidRangeError extends Error implements ReducerError {
  errorCode = "InvalidRangeError" as ErrorCode;
  constructor(message = "InvalidRangeError") {
    super(message);
  }
}

export const errors = {
  SetBackfillEnabled: { NotInitializedError },

  AddDateRangeBackfill: {
    NotInitializedError,
    DuplicateBackfillIdError,
    InvalidRangeError,
  },
};
