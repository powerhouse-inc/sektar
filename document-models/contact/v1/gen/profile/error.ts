export type ErrorCode =
  | "InvalidTermsError"
  | "InvalidTagError"
  | "DuplicateTagError"
  | "TagNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvalidTermsError extends Error implements ReducerError {
  errorCode = "InvalidTermsError" as ErrorCode;
  constructor(message = "InvalidTermsError") {
    super(message);
  }
}

export class InvalidTagError extends Error implements ReducerError {
  errorCode = "InvalidTagError" as ErrorCode;
  constructor(message = "InvalidTagError") {
    super(message);
  }
}

export class DuplicateTagError extends Error implements ReducerError {
  errorCode = "DuplicateTagError" as ErrorCode;
  constructor(message = "DuplicateTagError") {
    super(message);
  }
}

export class TagNotFoundError extends Error implements ReducerError {
  errorCode = "TagNotFoundError" as ErrorCode;
  constructor(message = "TagNotFoundError") {
    super(message);
  }
}

export const errors = {
  SetPaymentTerms: { InvalidTermsError },

  AddTag: { InvalidTagError, DuplicateTagError },

  RemoveTag: { TagNotFoundError },
};
