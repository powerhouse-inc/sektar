export type ErrorCode = "DuplicateItemIdError" | "ItemNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
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
  AddTransport: { DuplicateItemIdError },

  UpdateTransport: { ItemNotFoundError },

  RemoveTransport: { ItemNotFoundError },
};
