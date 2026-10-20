export type ErrorCode =
  | "InvalidTagLabelError"
  | "DuplicateTagError"
  | "UnknownTagError"
  | "EmptyTagLabelError"
  | "TagLabelTakenError"
  | "TagNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvalidTagLabelError extends Error implements ReducerError {
  errorCode = "InvalidTagLabelError" as ErrorCode;
  constructor(message = "InvalidTagLabelError") {
    super(message);
  }
}

export class DuplicateTagError extends Error implements ReducerError {
  errorCode = "DuplicateTagError" as ErrorCode;
  constructor(message = "DuplicateTagError") {
    super(message);
  }
}

export class UnknownTagError extends Error implements ReducerError {
  errorCode = "UnknownTagError" as ErrorCode;
  constructor(message = "UnknownTagError") {
    super(message);
  }
}

export class EmptyTagLabelError extends Error implements ReducerError {
  errorCode = "EmptyTagLabelError" as ErrorCode;
  constructor(message = "EmptyTagLabelError") {
    super(message);
  }
}

export class TagLabelTakenError extends Error implements ReducerError {
  errorCode = "TagLabelTakenError" as ErrorCode;
  constructor(message = "TagLabelTakenError") {
    super(message);
  }
}

export class TagNotFoundError extends Error implements ReducerError {
  errorCode = "TagNotFoundError" as ErrorCode;
  constructor(message = "TagNotFoundError") {
    super(message);
  }
}

export const errors = {
  AddTag: { InvalidTagLabelError, DuplicateTagError },

  UpdateTag: { UnknownTagError, EmptyTagLabelError, TagLabelTakenError },

  RemoveTag: { TagNotFoundError },
};
