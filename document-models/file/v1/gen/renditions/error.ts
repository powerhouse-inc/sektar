export type ErrorCode =
  | "DuplicateRenditionError"
  | "InvalidRenditionMimeTypeError"
  | "RenditionContentError"
  | "UnknownRenditionError"
  | "InvalidUpdatedMimeTypeError"
  | "RenditionNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class DuplicateRenditionError extends Error implements ReducerError {
  errorCode = "DuplicateRenditionError" as ErrorCode;
  constructor(message = "DuplicateRenditionError") {
    super(message);
  }
}

export class InvalidRenditionMimeTypeError
  extends Error
  implements ReducerError
{
  errorCode = "InvalidRenditionMimeTypeError" as ErrorCode;
  constructor(message = "InvalidRenditionMimeTypeError") {
    super(message);
  }
}

export class RenditionContentError extends Error implements ReducerError {
  errorCode = "RenditionContentError" as ErrorCode;
  constructor(message = "RenditionContentError") {
    super(message);
  }
}

export class UnknownRenditionError extends Error implements ReducerError {
  errorCode = "UnknownRenditionError" as ErrorCode;
  constructor(message = "UnknownRenditionError") {
    super(message);
  }
}

export class InvalidUpdatedMimeTypeError extends Error implements ReducerError {
  errorCode = "InvalidUpdatedMimeTypeError" as ErrorCode;
  constructor(message = "InvalidUpdatedMimeTypeError") {
    super(message);
  }
}

export class RenditionNotFoundError extends Error implements ReducerError {
  errorCode = "RenditionNotFoundError" as ErrorCode;
  constructor(message = "RenditionNotFoundError") {
    super(message);
  }
}

export const errors = {
  AddRendition: {
    DuplicateRenditionError,
    InvalidRenditionMimeTypeError,
    RenditionContentError,
  },

  UpdateRendition: { UnknownRenditionError, InvalidUpdatedMimeTypeError },

  RemoveRendition: { RenditionNotFoundError },
};
