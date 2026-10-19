export type ErrorCode =
  | "StartNotDraftError"
  | "StartWithoutCursorsError"
  | "PauseNotInProgressError"
  | "UnpauseNotPausedError"
  | "ResetAlreadyDraftError"
  | "TerminateAlreadyFinishedError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class StartNotDraftError extends Error implements ReducerError {
  errorCode = "StartNotDraftError" as ErrorCode;
  constructor(message = "StartNotDraftError") {
    super(message);
  }
}

export class StartWithoutCursorsError extends Error implements ReducerError {
  errorCode = "StartWithoutCursorsError" as ErrorCode;
  constructor(message = "StartWithoutCursorsError") {
    super(message);
  }
}

export class PauseNotInProgressError extends Error implements ReducerError {
  errorCode = "PauseNotInProgressError" as ErrorCode;
  constructor(message = "PauseNotInProgressError") {
    super(message);
  }
}

export class UnpauseNotPausedError extends Error implements ReducerError {
  errorCode = "UnpauseNotPausedError" as ErrorCode;
  constructor(message = "UnpauseNotPausedError") {
    super(message);
  }
}

export class ResetAlreadyDraftError extends Error implements ReducerError {
  errorCode = "ResetAlreadyDraftError" as ErrorCode;
  constructor(message = "ResetAlreadyDraftError") {
    super(message);
  }
}

export class TerminateAlreadyFinishedError
  extends Error
  implements ReducerError
{
  errorCode = "TerminateAlreadyFinishedError" as ErrorCode;
  constructor(message = "TerminateAlreadyFinishedError") {
    super(message);
  }
}

export const errors = {
  Start: { StartNotDraftError, StartWithoutCursorsError },

  Pause: { PauseNotInProgressError },

  Unpause: { UnpauseNotPausedError },

  Reset: { ResetAlreadyDraftError },

  Terminate: { TerminateAlreadyFinishedError },
};
