export type ErrorCode =
  | "CaptureIntoDiscardedCollectionError"
  | "CaptureUnnamespacedIdentifierError"
  | "CaptureSourceIdTakenError"
  | "AttachSourceNotFoundError"
  | "AttachRefAlreadyPresentError"
  | "DetachSourceNotFoundError"
  | "DetachRefNotFoundError"
  | "ReferenceSourceNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class CaptureIntoDiscardedCollectionError
  extends Error
  implements ReducerError
{
  errorCode = "CaptureIntoDiscardedCollectionError" as ErrorCode;
  constructor(message = "CaptureIntoDiscardedCollectionError") {
    super(message);
  }
}

export class CaptureUnnamespacedIdentifierError
  extends Error
  implements ReducerError
{
  errorCode = "CaptureUnnamespacedIdentifierError" as ErrorCode;
  constructor(message = "CaptureUnnamespacedIdentifierError") {
    super(message);
  }
}

export class CaptureSourceIdTakenError extends Error implements ReducerError {
  errorCode = "CaptureSourceIdTakenError" as ErrorCode;
  constructor(message = "CaptureSourceIdTakenError") {
    super(message);
  }
}

export class AttachSourceNotFoundError extends Error implements ReducerError {
  errorCode = "AttachSourceNotFoundError" as ErrorCode;
  constructor(message = "AttachSourceNotFoundError") {
    super(message);
  }
}

export class AttachRefAlreadyPresentError
  extends Error
  implements ReducerError
{
  errorCode = "AttachRefAlreadyPresentError" as ErrorCode;
  constructor(message = "AttachRefAlreadyPresentError") {
    super(message);
  }
}

export class DetachSourceNotFoundError extends Error implements ReducerError {
  errorCode = "DetachSourceNotFoundError" as ErrorCode;
  constructor(message = "DetachSourceNotFoundError") {
    super(message);
  }
}

export class DetachRefNotFoundError extends Error implements ReducerError {
  errorCode = "DetachRefNotFoundError" as ErrorCode;
  constructor(message = "DetachRefNotFoundError") {
    super(message);
  }
}

export class ReferenceSourceNotFoundError
  extends Error
  implements ReducerError
{
  errorCode = "ReferenceSourceNotFoundError" as ErrorCode;
  constructor(message = "ReferenceSourceNotFoundError") {
    super(message);
  }
}

export const errors = {
  CaptureSource: {
    CaptureIntoDiscardedCollectionError,
    CaptureUnnamespacedIdentifierError,
    CaptureSourceIdTakenError,
  },

  AttachToSource: { AttachSourceNotFoundError, AttachRefAlreadyPresentError },

  DetachFromSource: { DetachSourceNotFoundError, DetachRefNotFoundError },

  AddSourceReference: { ReferenceSourceNotFoundError },
};
