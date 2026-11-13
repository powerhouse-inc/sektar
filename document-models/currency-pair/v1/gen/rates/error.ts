export type ErrorCode =
  | "PAIR_NOT_SET"
  | "EMPTY_RATES"
  | "INVALID_RATE"
  | "DUPLICATE_DATE"
  | "MANUAL_PAIR_NOT_SET"
  | "INVALID_MANUAL_RATE"
  | "RATE_NOT_FOUND";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class PairNotSetError extends Error implements ReducerError {
  errorCode = "PAIR_NOT_SET" as ErrorCode;
  constructor(message = "PairNotSetError") {
    super(message);
  }
}

export class EmptyRatesError extends Error implements ReducerError {
  errorCode = "EMPTY_RATES" as ErrorCode;
  constructor(message = "EmptyRatesError") {
    super(message);
  }
}

export class InvalidRateError extends Error implements ReducerError {
  errorCode = "INVALID_RATE" as ErrorCode;
  constructor(message = "InvalidRateError") {
    super(message);
  }
}

export class DuplicateDateError extends Error implements ReducerError {
  errorCode = "DUPLICATE_DATE" as ErrorCode;
  constructor(message = "DuplicateDateError") {
    super(message);
  }
}

export class ManualPairNotSetError extends Error implements ReducerError {
  errorCode = "MANUAL_PAIR_NOT_SET" as ErrorCode;
  constructor(message = "ManualPairNotSetError") {
    super(message);
  }
}

export class InvalidManualRateError extends Error implements ReducerError {
  errorCode = "INVALID_MANUAL_RATE" as ErrorCode;
  constructor(message = "InvalidManualRateError") {
    super(message);
  }
}

export class RateNotFoundError extends Error implements ReducerError {
  errorCode = "RATE_NOT_FOUND" as ErrorCode;
  constructor(message = "RateNotFoundError") {
    super(message);
  }
}

export const errors = {
  RecordRates: {
    PairNotSetError,
    EmptyRatesError,
    InvalidRateError,
    DuplicateDateError,
  },

  SetManualRate: { ManualPairNotSetError, InvalidManualRateError },

  RemoveRate: { RateNotFoundError },
};
