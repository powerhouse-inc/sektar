export type ErrorCode =
  | "InvoiceNotDraftError"
  | "InvalidVatReasonError"
  | "VatReasonNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvoiceNotDraftError extends Error implements ReducerError {
  errorCode = "InvoiceNotDraftError" as ErrorCode;
  constructor(message = "InvoiceNotDraftError") {
    super(message);
  }
}

export class InvalidVatReasonError extends Error implements ReducerError {
  errorCode = "InvalidVatReasonError" as ErrorCode;
  constructor(message = "InvalidVatReasonError") {
    super(message);
  }
}

export class VatReasonNotFoundError extends Error implements ReducerError {
  errorCode = "VatReasonNotFoundError" as ErrorCode;
  constructor(message = "VatReasonNotFoundError") {
    super(message);
  }
}

export const errors = {
  SetVatReason: { InvoiceNotDraftError, InvalidVatReasonError },

  RemoveVatReason: { InvoiceNotDraftError, VatReasonNotFoundError },
};
