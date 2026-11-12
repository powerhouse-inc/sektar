export type ErrorCode = "INVALID_CURRENCY";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvalidCurrencyError extends Error implements ReducerError {
  errorCode = "INVALID_CURRENCY" as ErrorCode;
  constructor(message = "InvalidCurrencyError") {
    super(message);
  }
}

export const errors = {
  SetBaseCurrency: { InvalidCurrencyError },
};
