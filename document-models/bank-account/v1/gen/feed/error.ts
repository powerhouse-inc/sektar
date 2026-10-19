export type ErrorCode =
  | "EmptyImportError"
  | "DuplicateTransactionError"
  | "TransactionNotFoundError"
  | "TransactionExcludedError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class EmptyImportError extends Error implements ReducerError {
  errorCode = "EmptyImportError" as ErrorCode;
  constructor(message = "EmptyImportError") {
    super(message);
  }
}

export class DuplicateTransactionError extends Error implements ReducerError {
  errorCode = "DuplicateTransactionError" as ErrorCode;
  constructor(message = "DuplicateTransactionError") {
    super(message);
  }
}

export class TransactionNotFoundError extends Error implements ReducerError {
  errorCode = "TransactionNotFoundError" as ErrorCode;
  constructor(message = "TransactionNotFoundError") {
    super(message);
  }
}

export class TransactionExcludedError extends Error implements ReducerError {
  errorCode = "TransactionExcludedError" as ErrorCode;
  constructor(message = "TransactionExcludedError") {
    super(message);
  }
}

export const errors = {
  ImportTransactions: { EmptyImportError, DuplicateTransactionError },

  CategorizeTransaction: { TransactionNotFoundError },

  MatchTransaction: { TransactionNotFoundError, TransactionExcludedError },

  UnmatchTransaction: { TransactionNotFoundError },

  ExcludeTransaction: { TransactionNotFoundError },
};
