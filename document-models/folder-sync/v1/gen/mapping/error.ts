export type ErrorCode = "InvalidLocalPathError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvalidLocalPathError extends Error implements ReducerError {
  errorCode = "InvalidLocalPathError" as ErrorCode;
  constructor(message = "InvalidLocalPathError") {
    super(message);
  }
}

export const errors = {
  SetLocalPath: { InvalidLocalPathError },
};
