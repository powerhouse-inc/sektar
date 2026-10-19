export type ErrorCode = "PersonNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class PersonNotFoundError extends Error implements ReducerError {
  errorCode = "PersonNotFoundError" as ErrorCode;
  constructor(message = "PersonNotFoundError") {
    super(message);
  }
}

export const errors = {
  UpdatePerson: { PersonNotFoundError },

  RemovePerson: { PersonNotFoundError },
};
