export type ErrorCode =
  | "AttachmentsClosedError"
  | "AttachmentLineNotFoundError"
  | "InvalidAttachmentError"
  | "AttachmentNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class AttachmentsClosedError extends Error implements ReducerError {
  errorCode = "AttachmentsClosedError" as ErrorCode;
  constructor(message = "AttachmentsClosedError") {
    super(message);
  }
}

export class AttachmentLineNotFoundError extends Error implements ReducerError {
  errorCode = "AttachmentLineNotFoundError" as ErrorCode;
  constructor(message = "AttachmentLineNotFoundError") {
    super(message);
  }
}

export class InvalidAttachmentError extends Error implements ReducerError {
  errorCode = "InvalidAttachmentError" as ErrorCode;
  constructor(message = "InvalidAttachmentError") {
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
  AddAttachment: {
    AttachmentsClosedError,
    AttachmentLineNotFoundError,
    InvalidAttachmentError,
  },

  UpdateAttachment: { AttachmentsClosedError, AttachmentNotFoundError },

  RemoveAttachment: { AttachmentsClosedError, AttachmentNotFoundError },

  MoveAttachment: {
    AttachmentsClosedError,
    AttachmentNotFoundError,
    AttachmentLineNotFoundError,
  },
};
