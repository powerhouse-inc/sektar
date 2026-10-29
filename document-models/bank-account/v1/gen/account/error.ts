export type ErrorCode = "CURRENCY_LOCKED";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class CurrencyLockedError extends Error implements ReducerError {
  errorCode = "CURRENCY_LOCKED" as ErrorCode;
  constructor(message = "CurrencyLockedError") {
    super(message);
  }
}

export const errors = {
  SetAccountDetails: { CurrencyLockedError },
};
