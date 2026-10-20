export type ErrorCode =
  | "InvalidSourceFileNameError"
  | "InvalidSourceDocumentTypeError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvalidSourceFileNameError extends Error implements ReducerError {
  errorCode = "InvalidSourceFileNameError" as ErrorCode;
  constructor(message = "InvalidSourceFileNameError") {
    super(message);
  }
}

export class InvalidSourceDocumentTypeError
  extends Error
  implements ReducerError
{
  errorCode = "InvalidSourceDocumentTypeError" as ErrorCode;
  constructor(message = "InvalidSourceDocumentTypeError") {
    super(message);
  }
}

export const errors = {
  SetAttachmentSource: { InvalidSourceFileNameError },

  SetDocumentSource: { InvalidSourceDocumentTypeError },
};
