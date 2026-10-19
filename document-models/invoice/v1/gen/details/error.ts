export type ErrorCode = "InvoiceClosedError" | "InvoiceIssuedError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvoiceClosedError extends Error implements ReducerError {
  errorCode = "InvoiceClosedError" as ErrorCode;
  constructor(message = "InvoiceClosedError") {
    super(message);
  }
}

export class InvoiceIssuedError extends Error implements ReducerError {
  errorCode = "InvoiceIssuedError" as ErrorCode;
  constructor(message = "InvoiceIssuedError") {
    super(message);
  }
}

export const errors = {
  SetInvoiceDetails: { InvoiceClosedError, InvoiceIssuedError },
};
