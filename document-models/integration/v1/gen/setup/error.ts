export type ErrorCode =
  | "AlreadyInitializedError"
  | "NotInitializedError"
  | "WrongKindError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class AlreadyInitializedError extends Error implements ReducerError {
  errorCode = "AlreadyInitializedError" as ErrorCode;
  constructor(message = "AlreadyInitializedError") {
    super(message);
  }
}

export class NotInitializedError extends Error implements ReducerError {
  errorCode = "NotInitializedError" as ErrorCode;
  constructor(message = "NotInitializedError") {
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

  SetAccess: { NotInitializedError },

  SetConnection: { NotInitializedError },

  SetCalendarSource: { WrongKindError },

  SetEmailSource: { WrongKindError },

  SetTransactionsSource: { WrongKindError },
};
