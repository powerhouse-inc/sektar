export type ErrorCode = "RunnerTakenError" | "BackfillNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class RunnerTakenError extends Error implements ReducerError {
  errorCode = "RunnerTakenError" as ErrorCode;
  constructor(message = "RunnerTakenError") {
    super(message);
  }
}

export class BackfillNotFoundError extends Error implements ReducerError {
  errorCode = "BackfillNotFoundError" as ErrorCode;
  constructor(message = "BackfillNotFoundError") {
    super(message);
  }
}

export const errors = {
  RecordRunner: { RunnerTakenError },

  RecordBackfillDocument: { BackfillNotFoundError },
};
