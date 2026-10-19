export type ErrorCode = "SetCursorDescriptionCursorNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class SetCursorDescriptionCursorNotFoundError
  extends Error
  implements ReducerError
{
  errorCode = "SetCursorDescriptionCursorNotFoundError" as ErrorCode;
  constructor(message = "SetCursorDescriptionCursorNotFoundError") {
    super(message);
  }
}

export const errors = {
  SetCursorDescription: { SetCursorDescriptionCursorNotFoundError },
};
