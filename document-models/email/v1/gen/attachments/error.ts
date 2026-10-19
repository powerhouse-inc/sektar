export type ErrorCode =
  | "InvalidFileNameError"
  | "DuplicateAttachmentError"
  | "AttachmentNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvalidFileNameError extends Error implements ReducerError {
  errorCode = "InvalidFileNameError" as ErrorCode;
  constructor(message = "InvalidFileNameError") {
    super(message);
  }
}

export class DuplicateAttachmentError extends Error implements ReducerError {
  errorCode = "DuplicateAttachmentError" as ErrorCode;
  constructor(message = "DuplicateAttachmentError") {
    super(message);
  }
}

export class AttachmentNotFoundError extends Error implements ReducerError {
  errorCode = "AttachmentNotFoundError" as ErrorCode;
  constructor(message = "AttachmentNotFoundError") {
    super(message);
  }
}

export const errors = {
  AddAttachment: { InvalidFileNameError, DuplicateAttachmentError },

  RemoveAttachment: { AttachmentNotFoundError },
};
