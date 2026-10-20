export type ErrorCode =
  | "InvalidDatesError"
  | "DuplicateItemIdError"
  | "ItemNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvalidDatesError extends Error implements ReducerError {
  errorCode = "InvalidDatesError" as ErrorCode;
  constructor(message = "InvalidDatesError") {
    super(message);
  }
}

export class DuplicateItemIdError extends Error implements ReducerError {
  errorCode = "DuplicateItemIdError" as ErrorCode;
  constructor(message = "DuplicateItemIdError") {
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
  SetDetails: { InvalidDatesError },

  AddDestination: { DuplicateItemIdError, InvalidDatesError },

  UpdateDestination: { ItemNotFoundError },

  RemoveDestination: { ItemNotFoundError },
};
