export type ErrorCode =
  | "AddAliasSourceNotFoundError"
  | "AddAliasUnnamespacedError"
  | "AliasAlreadyClaimedError"
  | "RemoveAliasSourceNotFoundError"
  | "CannotRemoveCanonicalIdentifierError"
  | "AliasNotFoundError"
  | "MergeKeepNotFoundError"
  | "MergeSourceNotFoundError"
  | "CannotMergeSourceIntoItselfError"
  | "MergeAlreadyMergedError"
  | "SplitSourceNotFoundError"
  | "SourceNotMergedError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class AddAliasSourceNotFoundError extends Error implements ReducerError {
  errorCode = "AddAliasSourceNotFoundError" as ErrorCode;
  constructor(message = "AddAliasSourceNotFoundError") {
    super(message);
  }
}

export class AddAliasUnnamespacedError extends Error implements ReducerError {
  errorCode = "AddAliasUnnamespacedError" as ErrorCode;
  constructor(message = "AddAliasUnnamespacedError") {
    super(message);
  }
}

export class AliasAlreadyClaimedError extends Error implements ReducerError {
  errorCode = "AliasAlreadyClaimedError" as ErrorCode;
  constructor(message = "AliasAlreadyClaimedError") {
    super(message);
  }
}

export class RemoveAliasSourceNotFoundError
  extends Error
  implements ReducerError
{
  errorCode = "RemoveAliasSourceNotFoundError" as ErrorCode;
  constructor(message = "RemoveAliasSourceNotFoundError") {
    super(message);
  }
}

export class CannotRemoveCanonicalIdentifierError
  extends Error
  implements ReducerError
{
  errorCode = "CannotRemoveCanonicalIdentifierError" as ErrorCode;
  constructor(message = "CannotRemoveCanonicalIdentifierError") {
    super(message);
  }
}

export class AliasNotFoundError extends Error implements ReducerError {
  errorCode = "AliasNotFoundError" as ErrorCode;
  constructor(message = "AliasNotFoundError") {
    super(message);
  }
}

export class MergeKeepNotFoundError extends Error implements ReducerError {
  errorCode = "MergeKeepNotFoundError" as ErrorCode;
  constructor(message = "MergeKeepNotFoundError") {
    super(message);
  }
}

export class MergeSourceNotFoundError extends Error implements ReducerError {
  errorCode = "MergeSourceNotFoundError" as ErrorCode;
  constructor(message = "MergeSourceNotFoundError") {
    super(message);
  }
}

export class CannotMergeSourceIntoItselfError
  extends Error
  implements ReducerError
{
  errorCode = "CannotMergeSourceIntoItselfError" as ErrorCode;
  constructor(message = "CannotMergeSourceIntoItselfError") {
    super(message);
  }
}

export class MergeAlreadyMergedError extends Error implements ReducerError {
  errorCode = "MergeAlreadyMergedError" as ErrorCode;
  constructor(message = "MergeAlreadyMergedError") {
    super(message);
  }
}

export class SplitSourceNotFoundError extends Error implements ReducerError {
  errorCode = "SplitSourceNotFoundError" as ErrorCode;
  constructor(message = "SplitSourceNotFoundError") {
    super(message);
  }
}

export class SourceNotMergedError extends Error implements ReducerError {
  errorCode = "SourceNotMergedError" as ErrorCode;
  constructor(message = "SourceNotMergedError") {
    super(message);
  }
}

export const errors = {
  AddAlias: {
    AddAliasSourceNotFoundError,
    AddAliasUnnamespacedError,
    AliasAlreadyClaimedError,
  },

  RemoveAlias: {
    RemoveAliasSourceNotFoundError,
    CannotRemoveCanonicalIdentifierError,
    AliasNotFoundError,
  },

  MergeSources: {
    MergeKeepNotFoundError,
    MergeSourceNotFoundError,
    CannotMergeSourceIntoItselfError,
    MergeAlreadyMergedError,
  },

  SplitSource: { SplitSourceNotFoundError, SourceNotMergedError },
};
