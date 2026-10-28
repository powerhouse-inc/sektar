export type ErrorCode = "AlreadyInitializedError" | "WrongKindError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class AlreadyInitializedError extends Error implements ReducerError {
  errorCode = "AlreadyInitializedError" as ErrorCode;
  constructor(message = "AlreadyInitializedError") {
    super(message);
  }
}

export class WrongKindError extends Error implements ReducerError {
  errorCode = "WrongKindError" as ErrorCode;
  constructor(message = "WrongKindError") {
    super(message);
  }
}

export const errors = {
  Initialize: { AlreadyInitializedError },

  SetCalendarSource: { WrongKindError },
};
