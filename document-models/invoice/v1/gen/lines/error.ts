export type ErrorCode =
  | "InvoiceNotDraftError"
  | "InvalidLineError"
  | "LineNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvoiceNotDraftError extends Error implements ReducerError {
  errorCode = "InvoiceNotDraftError" as ErrorCode;
  constructor(message = "InvoiceNotDraftError") {
    super(message);
  }
}

export class InvalidLineError extends Error implements ReducerError {
  errorCode = "InvalidLineError" as ErrorCode;
  constructor(message = "InvalidLineError") {
    super(message);
  }
}

export class LineNotFoundError extends Error implements ReducerError {
  errorCode = "LineNotFoundError" as ErrorCode;
  constructor(message = "LineNotFoundError") {
    super(message);
  }
}

export const errors = {
  AddLine: { InvoiceNotDraftError, InvalidLineError },

  UpdateLine: { InvoiceNotDraftError, LineNotFoundError, InvalidLineError },

  RemoveLine: { InvoiceNotDraftError, LineNotFoundError },
};
