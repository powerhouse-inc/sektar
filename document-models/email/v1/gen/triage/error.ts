export type ErrorCode =
  | "AlreadyArchivedError"
  | "NotArchivedError"
  | "InvalidLabelError"
  | "LabelNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class AlreadyArchivedError extends Error implements ReducerError {
  errorCode = "AlreadyArchivedError" as ErrorCode;
  constructor(message = "AlreadyArchivedError") {
    super(message);
  }
}

export class NotArchivedError extends Error implements ReducerError {
  errorCode = "NotArchivedError" as ErrorCode;
  constructor(message = "NotArchivedError") {
    super(message);
  }
}

export class InvalidLabelError extends Error implements ReducerError {
  errorCode = "InvalidLabelError" as ErrorCode;
  constructor(message = "InvalidLabelError") {
    super(message);
  }
}

export class LabelNotFoundError extends Error implements ReducerError {
  errorCode = "LabelNotFoundError" as ErrorCode;
  constructor(message = "LabelNotFoundError") {
    super(message);
  }
}

export const errors = {
  Archive: { AlreadyArchivedError },

  Unarchive: { NotArchivedError },

  AddLabels: { InvalidLabelError },

  RemoveLabels: { LabelNotFoundError },
};
