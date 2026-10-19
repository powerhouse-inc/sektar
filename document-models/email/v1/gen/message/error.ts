export type ErrorCode = "InvalidExternalIdError" | "ExternalIdMismatchError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvalidExternalIdError extends Error implements ReducerError {
  errorCode = "InvalidExternalIdError" as ErrorCode;
  constructor(message = "InvalidExternalIdError") {
    super(message);
  }
}

export class ExternalIdMismatchError extends Error implements ReducerError {
  errorCode = "ExternalIdMismatchError" as ErrorCode;
  constructor(message = "ExternalIdMismatchError") {
    super(message);
  }
}

export const errors = {
  CaptureMessage: { InvalidExternalIdError, ExternalIdMismatchError },
};
