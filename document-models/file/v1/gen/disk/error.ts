export type ErrorCode =
  | "InvalidPlaceholderError"
  | "PlaceholderTargetError"
  | "NoDiskVersionError"
  | "PreviousVersionIdTakenError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvalidPlaceholderError extends Error implements ReducerError {
  errorCode = "InvalidPlaceholderError" as ErrorCode;
  constructor(message = "InvalidPlaceholderError") {
    super(message);
  }
}

export class PlaceholderTargetError extends Error implements ReducerError {
  errorCode = "PlaceholderTargetError" as ErrorCode;
  constructor(message = "PlaceholderTargetError") {
    super(message);
  }
}

export class NoDiskVersionError extends Error implements ReducerError {
  errorCode = "NoDiskVersionError" as ErrorCode;
  constructor(message = "NoDiskVersionError") {
    super(message);
  }
}

export class PreviousVersionIdTakenError extends Error implements ReducerError {
  errorCode = "PreviousVersionIdTakenError" as ErrorCode;
  constructor(message = "PreviousVersionIdTakenError") {
    super(message);
  }
}

export const errors = {
  SetPlaceholder: { InvalidPlaceholderError, PlaceholderTargetError },

  ApplyDiskVersion: { NoDiskVersionError, PreviousVersionIdTakenError },
};
