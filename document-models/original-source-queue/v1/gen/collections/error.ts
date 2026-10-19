export type ErrorCode =
  | "AddCollectionValueNotInProgressError"
  | "AddCollectionValueCollectionNotFoundError"
  | "AddCollectionValueEmptyError"
  | "ClearCollectionNotInProgressError"
  | "ClearCollectionCollectionNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class AddCollectionValueNotInProgressError
  extends Error
  implements ReducerError
{
  errorCode = "AddCollectionValueNotInProgressError" as ErrorCode;
  constructor(message = "AddCollectionValueNotInProgressError") {
    super(message);
  }
}

export class AddCollectionValueCollectionNotFoundError
  extends Error
  implements ReducerError
{
  errorCode = "AddCollectionValueCollectionNotFoundError" as ErrorCode;
  constructor(message = "AddCollectionValueCollectionNotFoundError") {
    super(message);
  }
}

export class AddCollectionValueEmptyError
  extends Error
  implements ReducerError
{
  errorCode = "AddCollectionValueEmptyError" as ErrorCode;
  constructor(message = "AddCollectionValueEmptyError") {
    super(message);
  }
}

export class ClearCollectionNotInProgressError
  extends Error
  implements ReducerError
{
  errorCode = "ClearCollectionNotInProgressError" as ErrorCode;
  constructor(message = "ClearCollectionNotInProgressError") {
    super(message);
  }
}

export class ClearCollectionCollectionNotFoundError
  extends Error
  implements ReducerError
{
  errorCode = "ClearCollectionCollectionNotFoundError" as ErrorCode;
  constructor(message = "ClearCollectionCollectionNotFoundError") {
    super(message);
  }
}

export const errors = {
  AddCollectionValue: {
    AddCollectionValueNotInProgressError,
    AddCollectionValueCollectionNotFoundError,
    AddCollectionValueEmptyError,
  },

  ClearCollection: {
    ClearCollectionNotInProgressError,
    ClearCollectionCollectionNotFoundError,
  },
};
