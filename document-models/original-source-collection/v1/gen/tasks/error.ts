export type ErrorCode =
  | "TaskIdTakenError"
  | "TaskSourceNotFoundError"
  | "SetTaskStatusNotFoundError"
  | "AssignTaskNotFoundError"
  | "SetTaskDescriptionNotFoundError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class TaskIdTakenError extends Error implements ReducerError {
  errorCode = "TaskIdTakenError" as ErrorCode;
  constructor(message = "TaskIdTakenError") {
    super(message);
  }
}

export class TaskSourceNotFoundError extends Error implements ReducerError {
  errorCode = "TaskSourceNotFoundError" as ErrorCode;
  constructor(message = "TaskSourceNotFoundError") {
    super(message);
  }
}

export class SetTaskStatusNotFoundError extends Error implements ReducerError {
  errorCode = "SetTaskStatusNotFoundError" as ErrorCode;
  constructor(message = "SetTaskStatusNotFoundError") {
    super(message);
  }
}

export class AssignTaskNotFoundError extends Error implements ReducerError {
  errorCode = "AssignTaskNotFoundError" as ErrorCode;
  constructor(message = "AssignTaskNotFoundError") {
    super(message);
  }
}

export class SetTaskDescriptionNotFoundError
  extends Error
  implements ReducerError
{
  errorCode = "SetTaskDescriptionNotFoundError" as ErrorCode;
  constructor(message = "SetTaskDescriptionNotFoundError") {
    super(message);
  }
}

export const errors = {
  CreateTask: { TaskIdTakenError, TaskSourceNotFoundError },

  SetTaskStatus: { SetTaskStatusNotFoundError },

  AssignTask: { AssignTaskNotFoundError },

  SetTaskDescription: { SetTaskDescriptionNotFoundError },
};
