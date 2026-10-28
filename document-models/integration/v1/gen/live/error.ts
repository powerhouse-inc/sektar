export type ErrorCode = "InvalidIntervalError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvalidIntervalError extends Error implements ReducerError {
  errorCode = "InvalidIntervalError" as ErrorCode;
  constructor(message = "InvalidIntervalError") {
    super(message);
  }
}

export const errors = {
  SetLiveInterval: { InvalidIntervalError },
};
