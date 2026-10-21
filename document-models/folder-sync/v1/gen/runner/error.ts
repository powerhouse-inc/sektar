export type ErrorCode =
  | "DuplicateRunIdError"
  | "RunNotFoundError"
  | "RunFinishedError"
  | "InvalidRunStatusError"
  | "DuplicateIssueIdError"
  | "IssueNotFoundError"
  | "PullNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class DuplicateRunIdError extends Error implements ReducerError {
  errorCode = "DuplicateRunIdError" as ErrorCode;
  constructor(message = "DuplicateRunIdError") {
    super(message);
  }
}

export class RunNotFoundError extends Error implements ReducerError {
  errorCode = "RunNotFoundError" as ErrorCode;
  constructor(message = "RunNotFoundError") {
    super(message);
  }
}

export class RunFinishedError extends Error implements ReducerError {
  errorCode = "RunFinishedError" as ErrorCode;
  constructor(message = "RunFinishedError") {
    super(message);
  }
}

export class InvalidRunStatusError extends Error implements ReducerError {
  errorCode = "InvalidRunStatusError" as ErrorCode;
  constructor(message = "InvalidRunStatusError") {
    super(message);
  }
}

export class DuplicateIssueIdError extends Error implements ReducerError {
  errorCode = "DuplicateIssueIdError" as ErrorCode;
  constructor(message = "DuplicateIssueIdError") {
    super(message);
  }
}

export class IssueNotFoundError extends Error implements ReducerError {
  errorCode = "IssueNotFoundError" as ErrorCode;
  constructor(message = "IssueNotFoundError") {
    super(message);
  }
}

export class PullNotFoundError extends Error implements ReducerError {
  errorCode = "PullNotFoundError" as ErrorCode;
  constructor(message = "PullNotFoundError") {
    super(message);
  }
}

export const errors = {
  StartRun: { DuplicateRunIdError },

  FinishRun: { RunNotFoundError, RunFinishedError, InvalidRunStatusError },

  SetIssues: { DuplicateIssueIdError },

  ResolveIssue: { IssueNotFoundError },

  CompletePull: { PullNotFoundError },
};
