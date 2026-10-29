export type ErrorCode =
  | "EMPTY_IMPORT"
  | "DUPLICATE_TRANSACTION"
  | "TRANSACTION_NOT_FOUND"
  | "TRANSACTION_PENDING"
  | "TRANSACTION_EXCLUDED"
  | "NOT_PENDING";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class EmptyImportError extends Error implements ReducerError {
  errorCode = "EMPTY_IMPORT" as ErrorCode;
  constructor(message = "EmptyImportError") {
    super(message);
  }
}

export class DuplicateTransactionError extends Error implements ReducerError {
  errorCode = "DUPLICATE_TRANSACTION" as ErrorCode;
  constructor(message = "DuplicateTransactionError") {
    super(message);
  }
}

export class TransactionNotFoundError extends Error implements ReducerError {
  errorCode = "TRANSACTION_NOT_FOUND" as ErrorCode;
  constructor(message = "TransactionNotFoundError") {
    super(message);
  }
}

export class TransactionPendingError extends Error implements ReducerError {
  errorCode = "TRANSACTION_PENDING" as ErrorCode;
  constructor(message = "TransactionPendingError") {
    super(message);
  }
}

export class TransactionExcludedError extends Error implements ReducerError {
  errorCode = "TRANSACTION_EXCLUDED" as ErrorCode;
  constructor(message = "TransactionExcludedError") {
    super(message);
  }
}

export class NotPendingError extends Error implements ReducerError {
  errorCode = "NOT_PENDING" as ErrorCode;
  constructor(message = "NotPendingError") {
    super(message);
  }
}

export const errors = {
  ImportTransactions: { EmptyImportError, DuplicateTransactionError },

  CategorizeTransaction: { TransactionNotFoundError, TransactionPendingError },

  MatchTransaction: {
    TransactionNotFoundError,
    TransactionExcludedError,
    TransactionPendingError,
  },

  UnmatchTransaction: { TransactionNotFoundError, TransactionPendingError },

  ExcludeTransaction: { TransactionNotFoundError, TransactionPendingError },

  RemovePendingTransactions: { NotPendingError },
};
