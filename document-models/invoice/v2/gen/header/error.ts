export type ErrorCode =
  | "InvoiceNotDraftError"
  | "InvoiceClosedError"
  | "InvalidPeriodError"
  | "DuplicateReferenceError"
  | "ReferenceNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvoiceNotDraftError extends Error implements ReducerError {
  errorCode = "InvoiceNotDraftError" as ErrorCode;
  constructor(message = "InvoiceNotDraftError") {
    super(message);
  }
}

export class InvoiceClosedError extends Error implements ReducerError {
  errorCode = "InvoiceClosedError" as ErrorCode;
  constructor(message = "InvoiceClosedError") {
    super(message);
  }
}

export class InvalidPeriodError extends Error implements ReducerError {
  errorCode = "InvalidPeriodError" as ErrorCode;
  constructor(message = "InvalidPeriodError") {
    super(message);
  }
}

export class DuplicateReferenceError extends Error implements ReducerError {
  errorCode = "DuplicateReferenceError" as ErrorCode;
  constructor(message = "DuplicateReferenceError") {
    super(message);
  }
}

export class ReferenceNotFoundError extends Error implements ReducerError {
  errorCode = "ReferenceNotFoundError" as ErrorCode;
  constructor(message = "ReferenceNotFoundError") {
    super(message);
  }
}

export const errors = {
  SetHeader: { InvoiceNotDraftError, InvoiceClosedError, InvalidPeriodError },

  AddPrecedingInvoice: { InvoiceNotDraftError, DuplicateReferenceError },

  RemovePrecedingInvoice: { InvoiceNotDraftError, ReferenceNotFoundError },
};
