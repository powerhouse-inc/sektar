export type ErrorCode =
  | "ReportLockedError"
  | "InvalidAmountError"
  | "ItemNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class ReportLockedError extends Error implements ReducerError {
  errorCode = "ReportLockedError" as ErrorCode;
  constructor(message = "ReportLockedError") {
    super(message);
  }
}

export class InvalidAmountError extends Error implements ReducerError {
  errorCode = "InvalidAmountError" as ErrorCode;
  constructor(message = "InvalidAmountError") {
    super(message);
  }
}

export class ItemNotFoundError extends Error implements ReducerError {
  errorCode = "ItemNotFoundError" as ErrorCode;
  constructor(message = "ItemNotFoundError") {
    super(message);
  }
}

export const errors = {
  SetReportDetails: { ReportLockedError },

  AddItem: { ReportLockedError, InvalidAmountError },

  UpdateItem: { ReportLockedError, ItemNotFoundError, InvalidAmountError },

  RemoveItem: { ReportLockedError, ItemNotFoundError },
};
