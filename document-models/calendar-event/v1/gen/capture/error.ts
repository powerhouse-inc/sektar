export type ErrorCode = "OtherEventError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class OtherEventError extends Error implements ReducerError {
  errorCode = "OtherEventError" as ErrorCode;
  constructor(message = "OtherEventError") {
    super(message);
  }
}

export const errors = {
  CaptureEvent: { OtherEventError },
};
