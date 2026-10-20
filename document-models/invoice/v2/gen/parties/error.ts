export type ErrorCode = "InvoiceNotDraftError";

export interface ReducerError {
  errorCode: ErrorCode;
}

export class InvoiceNotDraftError extends Error implements ReducerError {
  errorCode = "InvoiceNotDraftError" as ErrorCode;
  constructor(message = "InvoiceNotDraftError") {
    super(message);
  }
}

export const errors = {
  SetSeller: { InvoiceNotDraftError },

  SetBuyer: { InvoiceNotDraftError },
};
