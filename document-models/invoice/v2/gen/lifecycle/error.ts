export type ErrorCode =
  | "InvoiceNotDraftError"
  | "NoLinesError"
  | "InvalidNumberError"
  | "InvoiceNotOpenError"
  | "InvalidPaymentError"
  | "PaymentNotFoundError"
  | "InvoiceVoidError"
  | "InvoicePaidError";

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

export class InvalidNumberError extends Error implements ReducerError {
  errorCode = "InvalidNumberError" as ErrorCode;
  constructor(message = "InvalidNumberError") {
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

export class PaymentNotFoundError extends Error implements ReducerError {
  errorCode = "PaymentNotFoundError" as ErrorCode;
  constructor(message = "PaymentNotFoundError") {
    super(message);
  }
}

export class InvoiceVoidError extends Error implements ReducerError {
  errorCode = "InvoiceVoidError" as ErrorCode;
  constructor(message = "InvoiceVoidError") {
    super(message);
  }
}

export class InvoicePaidError extends Error implements ReducerError {
  errorCode = "InvoicePaidError" as ErrorCode;
  constructor(message = "InvoicePaidError") {
    super(message);
  }
}

export const errors = {
  IssueInvoice: { InvoiceNotDraftError, NoLinesError, InvalidNumberError },

  RecordPayment: { InvoiceNotOpenError, InvalidPaymentError },

  RemovePayment: { PaymentNotFoundError, InvoiceVoidError },

  VoidInvoice: { InvoicePaidError, InvoiceVoidError },
};
