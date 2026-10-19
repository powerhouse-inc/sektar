export type ErrorCode = "StatusUnchangedError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class StatusUnchangedError extends Error implements ReducerError {
  errorCode = "StatusUnchangedError" as ErrorCode;
  constructor(message = "StatusUnchangedError") {
    super(message);
  }
}

export const errors = {
  ArchiveContact: { StatusUnchangedError },
};
