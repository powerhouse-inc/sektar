export type ErrorCode =
  | "InvoiceNotDraftError"
  | "InvalidCurrencyError"
  | "InvalidRateError"
  | "RateNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvoiceNotDraftError extends Error implements ReducerError {
  errorCode = "InvoiceNotDraftError" as ErrorCode;
  constructor(message = "InvoiceNotDraftError") {
    super(message);
  }
}

export class InvalidCurrencyError extends Error implements ReducerError {
  errorCode = "InvalidCurrencyError" as ErrorCode;
  constructor(message = "InvalidCurrencyError") {
    super(message);
  }
}

export class InvalidRateError extends Error implements ReducerError {
  errorCode = "InvalidRateError" as ErrorCode;
  constructor(message = "InvalidRateError") {
    super(message);
  }
}

export class RateNotFoundError extends Error implements ReducerError {
  errorCode = "RateNotFoundError" as ErrorCode;
  constructor(message = "RateNotFoundError") {
    super(message);
  }
}

export const errors = {
  SetCurrency: { InvoiceNotDraftError, InvalidCurrencyError },

  SetExchangeRate: { InvoiceNotDraftError, InvalidRateError },

  RemoveExchangeRate: { InvoiceNotDraftError, RateNotFoundError },
};
