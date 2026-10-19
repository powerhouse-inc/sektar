export type ErrorCode =
  | "InvoiceNotDraftError"
  | "NoLinesError"
  | "InvoiceNotOpenError"
  | "InvalidPaymentError"
  | "InvoicePaidError"
  | "InvoiceVoidError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvoiceNotDraftError extends Error implements ReducerError {
  errorCode = "InvoiceNotDraftError" as ErrorCode;
  constructor(message = "InvoiceNotDraftError") {
    super(message);
  }
}

export class NoLinesError extends Error implements ReducerError {
  errorCode = "NoLinesError" as ErrorCode;
  constructor(message = "NoLinesError") {
    super(message);
  }
}

export class InvoiceNotOpenError extends Error implements ReducerError {
  errorCode = "InvoiceNotOpenError" as ErrorCode;
  constructor(message = "InvoiceNotOpenError") {
    super(message);
  }
}

export class InvalidPaymentError extends Error implements ReducerError {
  errorCode = "InvalidPaymentError" as ErrorCode;
  constructor(message = "InvalidPaymentError") {
    super(message);
  }
}

export class InvoicePaidError extends Error implements ReducerError {
  errorCode = "InvoicePaidError" as ErrorCode;
  constructor(message = "InvoicePaidError") {
    super(message);
  }
}

export class InvoiceVoidError extends Error implements ReducerError {
  errorCode = "InvoiceVoidError" as ErrorCode;
  constructor(message = "InvoiceVoidError") {
    super(message);
  }
}

export const errors = {
  IssueInvoice: { InvoiceNotDraftError, NoLinesError },

  RecordPayment: { InvoiceNotOpenError, InvalidPaymentError },

  VoidInvoice: { InvoicePaidError, InvoiceVoidError },
};
