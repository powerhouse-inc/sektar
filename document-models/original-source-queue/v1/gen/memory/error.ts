export type ErrorCode =
  | "UpdateMemoryFinishedError"
  | "UpdateMemoryKeyEmptyError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class UpdateMemoryFinishedError extends Error implements ReducerError {
  errorCode = "UpdateMemoryFinishedError" as ErrorCode;
  constructor(message = "UpdateMemoryFinishedError") {
    super(message);
  }
}

export class UpdateMemoryKeyEmptyError extends Error implements ReducerError {
  errorCode = "UpdateMemoryKeyEmptyError" as ErrorCode;
  constructor(message = "UpdateMemoryKeyEmptyError") {
    super(message);
  }
}

export const errors = {
  UpdateMemory: { UpdateMemoryFinishedError, UpdateMemoryKeyEmptyError },
};
