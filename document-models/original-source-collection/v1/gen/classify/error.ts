export type ErrorCode =
  | "SetSourceTitleNotFoundError"
  | "TagSourceNotFoundError"
  | "UntagSourceNotFoundError"
  | "SetSourceStatusNotFoundError"
  | "CannotRestatusMergedSourceError"
  | "DiscardSourceNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class SetSourceTitleNotFoundError extends Error implements ReducerError {
  errorCode = "SetSourceTitleNotFoundError" as ErrorCode;
  constructor(message = "SetSourceTitleNotFoundError") {
    super(message);
  }
}

export class TagSourceNotFoundError extends Error implements ReducerError {
  errorCode = "TagSourceNotFoundError" as ErrorCode;
  constructor(message = "TagSourceNotFoundError") {
    super(message);
  }
}

export class UntagSourceNotFoundError extends Error implements ReducerError {
  errorCode = "UntagSourceNotFoundError" as ErrorCode;
  constructor(message = "UntagSourceNotFoundError") {
    super(message);
  }
}

export class SetSourceStatusNotFoundError
  extends Error
  implements ReducerError
{
  errorCode = "SetSourceStatusNotFoundError" as ErrorCode;
  constructor(message = "SetSourceStatusNotFoundError") {
    super(message);
  }
}

export class CannotRestatusMergedSourceError
  extends Error
  implements ReducerError
{
  errorCode = "CannotRestatusMergedSourceError" as ErrorCode;
  constructor(message = "CannotRestatusMergedSourceError") {
    super(message);
  }
}

export class DiscardSourceNotFoundError extends Error implements ReducerError {
  errorCode = "DiscardSourceNotFoundError" as ErrorCode;
  constructor(message = "DiscardSourceNotFoundError") {
    super(message);
  }
}

export const errors = {
  SetSourceTitle: { SetSourceTitleNotFoundError },

  TagSource: { TagSourceNotFoundError },

  UntagSource: { UntagSourceNotFoundError },

  SetSourceStatus: {
    SetSourceStatusNotFoundError,
    CannotRestatusMergedSourceError,
  },

  DiscardSource: { DiscardSourceNotFoundError },
};
