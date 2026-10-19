export type ErrorCode =
  | "CollectionAlreadyDiscardedError"
  | "CollectionNotDiscardedError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class CollectionAlreadyDiscardedError
  extends Error
  implements ReducerError
{
  errorCode = "CollectionAlreadyDiscardedError" as ErrorCode;
  constructor(message = "CollectionAlreadyDiscardedError") {
    super(message);
  }
}

export class CollectionNotDiscardedError extends Error implements ReducerError {
  errorCode = "CollectionNotDiscardedError" as ErrorCode;
  constructor(message = "CollectionNotDiscardedError") {
    super(message);
  }
}

export const errors = {
  DiscardCollection: { CollectionAlreadyDiscardedError },

  RestoreCollection: { CollectionNotDiscardedError },
};
