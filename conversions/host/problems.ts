import type { ConversionProblem } from "../contracts.js";

export type RefusalStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 503;

export function isMissingDocument(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "DocumentNotFoundError" ||
      error.name === "DocumentPurgedError")
  );
}

export class ConversionRefusal extends Error {
  readonly status: RefusalStatus;
  readonly code: string;
  readonly retryable: boolean;
  /** Specifics for developers and support; never shown as the main text. */
  readonly detail: string | undefined;
  constructor(
    status: RefusalStatus,
    code: string,
    message: string,
    retryable: boolean,
    detail?: string,
  ) {
    super(message);
    this.name = "ConversionRefusal";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.detail = detail || undefined;
  }

  get problem(): ConversionProblem {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.detail ? { detail: this.detail } : {}),
    };
  }
}

export const notFound = () =>
  new ConversionRefusal(
    404,
    "not-found",
    "This conversion doesn't exist, or you don't have access to it.",
    false,
  );
export const forbidden = (what: string) =>
  new ConversionRefusal(
    403,
    "forbidden",
    `You don't have permission to ${what}.`,
    false,
  );
export const starting = () =>
  new ConversionRefusal(
    503,
    "starting",
    "Document conversion is still starting. Try again in a moment.",
    true,
  );
