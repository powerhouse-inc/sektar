export type ErrorCode = "RunnerTakenError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class RunnerTakenError extends Error implements ReducerError {
  errorCode = "RunnerTakenError" as ErrorCode;
  constructor(message = "RunnerTakenError") {
    super(message);
  }
}

export const errors = {
  RecordRunner: { RunnerTakenError },
};
