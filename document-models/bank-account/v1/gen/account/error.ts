export type ErrorCode = "CurrencyLockedError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class CurrencyLockedError extends Error implements ReducerError {
  errorCode = "CurrencyLockedError" as ErrorCode;
  constructor(message = "CurrencyLockedError") {
    super(message);
  }
}

export const errors = {
  SetAccountDetails: { CurrencyLockedError },
};
