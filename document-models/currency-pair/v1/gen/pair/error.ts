export type ErrorCode =
  | "INVALID_PAIR_CURRENCY"
  | "SAME_CURRENCY"
  | "PAIR_LOCKED";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvalidPairCurrencyError extends Error implements ReducerError {
  errorCode = "INVALID_PAIR_CURRENCY" as ErrorCode;
  constructor(message = "InvalidPairCurrencyError") {
    super(message);
  }
}

export class SameCurrencyError extends Error implements ReducerError {
  errorCode = "SAME_CURRENCY" as ErrorCode;
  constructor(message = "SameCurrencyError") {
    super(message);
  }
}

export class PairLockedError extends Error implements ReducerError {
  errorCode = "PAIR_LOCKED" as ErrorCode;
  constructor(message = "PairLockedError") {
    super(message);
  }
}

export const errors = {
  SetPair: { InvalidPairCurrencyError, SameCurrencyError, PairLockedError },
};
