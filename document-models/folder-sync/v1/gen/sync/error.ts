export type ErrorCode =
  | "NotConfiguredError"
  | "MappingDisabledError"
  | "FromDiskOffError"
  | "DuplicatePullIdError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class NotConfiguredError extends Error implements ReducerError {
  errorCode = "NotConfiguredError" as ErrorCode;
  constructor(message = "NotConfiguredError") {
    super(message);
  }
}

export class MappingDisabledError extends Error implements ReducerError {
  errorCode = "MappingDisabledError" as ErrorCode;
  constructor(message = "MappingDisabledError") {
    super(message);
  }
}

export class FromDiskOffError extends Error implements ReducerError {
  errorCode = "FromDiskOffError" as ErrorCode;
  constructor(message = "FromDiskOffError") {
    super(message);
  }
}

export class DuplicatePullIdError extends Error implements ReducerError {
  errorCode = "DuplicatePullIdError" as ErrorCode;
  constructor(message = "DuplicatePullIdError") {
    super(message);
  }
}

export const errors = {
  RequestSync: { NotConfiguredError, MappingDisabledError },

  RequestPull: {
    NotConfiguredError,
    MappingDisabledError,
    FromDiskOffError,
    DuplicatePullIdError,
  },
};
