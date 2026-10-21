export type ErrorCode = "NotConfiguredError" | "MappingDisabledError";

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

export const errors = {
  RequestSync: { NotConfiguredError, MappingDisabledError },
};
