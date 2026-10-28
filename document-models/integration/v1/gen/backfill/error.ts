export type ErrorCode = "DuplicateBackfillIdError" | "InvalidRangeError";

export interface ReducerError {
  errorCode: ErrorCode;
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
  AddDateRangeBackfill: { DuplicateBackfillIdError, InvalidRangeError },
};
