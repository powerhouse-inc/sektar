export type ErrorCode = "NotInitializedError" | "InvalidIntervalError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class NotInitializedError extends Error implements ReducerError {
  errorCode = "NotInitializedError" as ErrorCode;
  constructor(message = "NotInitializedError") {
    super(message);
  }
}

export class InvalidIntervalError extends Error implements ReducerError {
  errorCode = "InvalidIntervalError" as ErrorCode;
  constructor(message = "InvalidIntervalError") {
    super(message);
  }
}

export const errors = {
  SetLiveEnabled: { NotInitializedError },

  SetLiveInterval: { NotInitializedError, InvalidIntervalError },
};
