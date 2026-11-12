export type ErrorCode =
  | "CURRENCY_LOCKED"
  | "INVALID_ACCOUNT_CURRENCY"
  | "BALANCE_CURRENCY_MISMATCH"
  | "STALE_BALANCE";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class CurrencyLockedError extends Error implements ReducerError {
  errorCode = "CURRENCY_LOCKED" as ErrorCode;
  constructor(message = "CurrencyLockedError") {
    super(message);
  }
}

export class InvalidAccountCurrencyError extends Error implements ReducerError {
  errorCode = "INVALID_ACCOUNT_CURRENCY" as ErrorCode;
  constructor(message = "InvalidAccountCurrencyError") {
    super(message);
  }
}

export class BalanceCurrencyMismatchError
  extends Error
  implements ReducerError
{
  errorCode = "BALANCE_CURRENCY_MISMATCH" as ErrorCode;
  constructor(message = "BalanceCurrencyMismatchError") {
    super(message);
  }
}

export class StaleBalanceError extends Error implements ReducerError {
  errorCode = "STALE_BALANCE" as ErrorCode;
  constructor(message = "StaleBalanceError") {
    super(message);
  }
}

export const errors = {
  SetAccountDetails: { CurrencyLockedError },

  CorrectCurrency: { InvalidAccountCurrencyError },

  RecordBankBalance: { BalanceCurrencyMismatchError, StaleBalanceError },
};
