export type ErrorCode =
  | "CreateDateTimeCursorNotDraftError"
  | "DateTimeCursorIdTakenError"
  | "DateTimeCursorDeltaNotPositiveError"
  | "DateTimeCursorEmptySpanError"
  | "CreateNumberCursorNotDraftError"
  | "NumberCursorIdTakenError"
  | "NumberCursorStepNotPositiveError"
  | "CreateCollectionCursorNotDraftError"
  | "CollectionCursorIdTakenError"
  | "CollectionCursorCollectionNotFoundError"
  | "ReorderCursorsNotDraftError"
  | "CursorOrderMismatchError"
  | "SetCursorNameNotDraftError"
  | "SetCursorNameCursorNotFoundError"
  | "CreateCollectionNotDraftError"
  | "CollectionIdTakenError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class CreateDateTimeCursorNotDraftError
  extends Error
  implements ReducerError
{
  errorCode = "CreateDateTimeCursorNotDraftError" as ErrorCode;
  constructor(message = "CreateDateTimeCursorNotDraftError") {
    super(message);
  }
}

export class DateTimeCursorIdTakenError extends Error implements ReducerError {
  errorCode = "DateTimeCursorIdTakenError" as ErrorCode;
  constructor(message = "DateTimeCursorIdTakenError") {
    super(message);
  }
}

export class DateTimeCursorDeltaNotPositiveError
  extends Error
  implements ReducerError
{
  errorCode = "DateTimeCursorDeltaNotPositiveError" as ErrorCode;
  constructor(message = "DateTimeCursorDeltaNotPositiveError") {
    super(message);
  }
}

export class DateTimeCursorEmptySpanError
  extends Error
  implements ReducerError
{
  errorCode = "DateTimeCursorEmptySpanError" as ErrorCode;
  constructor(message = "DateTimeCursorEmptySpanError") {
    super(message);
  }
}

export class CreateNumberCursorNotDraftError
  extends Error
  implements ReducerError
{
  errorCode = "CreateNumberCursorNotDraftError" as ErrorCode;
  constructor(message = "CreateNumberCursorNotDraftError") {
    super(message);
  }
}

export class NumberCursorIdTakenError extends Error implements ReducerError {
  errorCode = "NumberCursorIdTakenError" as ErrorCode;
  constructor(message = "NumberCursorIdTakenError") {
    super(message);
  }
}

export class NumberCursorStepNotPositiveError
  extends Error
  implements ReducerError
{
  errorCode = "NumberCursorStepNotPositiveError" as ErrorCode;
  constructor(message = "NumberCursorStepNotPositiveError") {
    super(message);
  }
}

export class CreateCollectionCursorNotDraftError
  extends Error
  implements ReducerError
{
  errorCode = "CreateCollectionCursorNotDraftError" as ErrorCode;
  constructor(message = "CreateCollectionCursorNotDraftError") {
    super(message);
  }
}

export class CollectionCursorIdTakenError
  extends Error
  implements ReducerError
{
  errorCode = "CollectionCursorIdTakenError" as ErrorCode;
  constructor(message = "CollectionCursorIdTakenError") {
    super(message);
  }
}

export class CollectionCursorCollectionNotFoundError
  extends Error
  implements ReducerError
{
  errorCode = "CollectionCursorCollectionNotFoundError" as ErrorCode;
  constructor(message = "CollectionCursorCollectionNotFoundError") {
    super(message);
  }
}

export class ReorderCursorsNotDraftError extends Error implements ReducerError {
  errorCode = "ReorderCursorsNotDraftError" as ErrorCode;
  constructor(message = "ReorderCursorsNotDraftError") {
    super(message);
  }
}

export class CursorOrderMismatchError extends Error implements ReducerError {
  errorCode = "CursorOrderMismatchError" as ErrorCode;
  constructor(message = "CursorOrderMismatchError") {
    super(message);
  }
}

export class SetCursorNameNotDraftError extends Error implements ReducerError {
  errorCode = "SetCursorNameNotDraftError" as ErrorCode;
  constructor(message = "SetCursorNameNotDraftError") {
    super(message);
  }
}

export class SetCursorNameCursorNotFoundError
  extends Error
  implements ReducerError
{
  errorCode = "SetCursorNameCursorNotFoundError" as ErrorCode;
  constructor(message = "SetCursorNameCursorNotFoundError") {
    super(message);
  }
}

export class CreateCollectionNotDraftError
  extends Error
  implements ReducerError
{
  errorCode = "CreateCollectionNotDraftError" as ErrorCode;
  constructor(message = "CreateCollectionNotDraftError") {
    super(message);
  }
}

export class CollectionIdTakenError extends Error implements ReducerError {
  errorCode = "CollectionIdTakenError" as ErrorCode;
  constructor(message = "CollectionIdTakenError") {
    super(message);
  }
}

export const errors = {
  CreateDateTimeCursor: {
    CreateDateTimeCursorNotDraftError,
    DateTimeCursorIdTakenError,
    DateTimeCursorDeltaNotPositiveError,
    DateTimeCursorEmptySpanError,
  },

  CreateNumberCursor: {
    CreateNumberCursorNotDraftError,
    NumberCursorIdTakenError,
    NumberCursorStepNotPositiveError,
  },

  CreateCollectionCursor: {
    CreateCollectionCursorNotDraftError,
    CollectionCursorIdTakenError,
    CollectionCursorCollectionNotFoundError,
  },

  ReorderCursors: { ReorderCursorsNotDraftError, CursorOrderMismatchError },

  SetCursorName: {
    SetCursorNameNotDraftError,
    SetCursorNameCursorNotFoundError,
  },

  CreateCollection: { CreateCollectionNotDraftError, CollectionIdTakenError },
};
