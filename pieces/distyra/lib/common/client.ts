import {
  AuthenticationType,
  HttpError,
  HttpMethod,
  httpClient,
  type QueryParams,
} from "@powerhousedao/pieces-framework/common";

/**
 * The API and CDN stay on .com; only Distyra's website and customer portal use
 * .eu. The spec publishes exactly one server, so the Base URL field on the
 * connection exists only to point a test run somewhere else.
 */
export const DISTYRA_DEFAULT_BASE_URL = "https://api.distyra.com";

/** The credentials as stored on the connection; see ../auth.ts. */
export type DistyraCredentials = {
  baseUrl?: string | null;
  apiKey: string;
};

/** The envelope every non-2xx response shares. */
type DistyraErrorBody = {
  /** Stable machine-readable code, e.g. `invalid_key`, `rate_limited`. */
  error?: string;
  detail?: string;
  request_id?: string;
  /** On the per-connection bank-fetch 429: the next UTC midnight. */
  resets_at?: string;
  /** On the per-organization rate-limit 429. */
  retry_after_seconds?: number;
};

function normalizeBaseUrl(baseUrl: string | null | undefined): string {
  const trimmed = baseUrl?.trim();
  if (!trimmed) return DISTYRA_DEFAULT_BASE_URL;
  return trimmed.replace(/\/+$/, "");
}

function asErrorBody(body: unknown): DistyraErrorBody {
  return typeof body === "object" && body !== null
    ? (body as DistyraErrorBody)
    : {};
}

/** The machine-readable code, when the failure carried Distyra's envelope. */
export function distyraErrorCode(error: unknown): string | undefined {
  return error instanceof HttpError
    ? asErrorBody(error.response.body).error
    : undefined;
}

/**
 * Flatten a failure into one line. The raw HttpError stringifies to `[object
 * Object]` in the run log, which hides the one field worth reading.
 */
export function describeDistyraError(error: unknown): string {
  if (!(error instanceof HttpError)) {
    return error instanceof Error
      ? `Distyra request failed: ${error.message}`
      : "Distyra request failed for an unknown reason.";
  }

  const { status, body } = error.response;
  const envelope = asErrorBody(body);
  const parts = [
    `Distyra API returned ${status}${envelope.error ? ` (${envelope.error})` : ""}.`,
  ];

  if (envelope.detail) parts.push(envelope.detail);

  // The two 429s mean different things and want different responses, so say
  // which one this is rather than leaving the reader to guess.
  if (envelope.error === "bank_fetch_limit_reached") {
    parts.push(
      "This is the bank's PSD2 limit of 4 unattended fetches per connection per day, not a limit on your Distyra account. Poll less often, or send the PSU IP address and user agent when your own user is on screen — those fetches are exempt.",
    );
  }
  if (envelope.resets_at) parts.push(`Resets at ${envelope.resets_at}.`);
  if (envelope.retry_after_seconds !== undefined) {
    parts.push(`Retry after ${envelope.retry_after_seconds}s.`);
  }
  if (envelope.request_id) parts.push(`Request id: ${envelope.request_id}.`);

  return parts.join(" ");
}

/** Drop the params the caller left blank; the API treats absent and "" alike. */
function toQueryParams(
  query:
    | Record<string, string | number | boolean | null | undefined>
    | undefined,
): QueryParams {
  const params: QueryParams = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      params[key] = String(value);
    }
  }
  return params;
}

/**
 * Send one authenticated request and return its parsed body. Failures are
 * rethrown as a plain Error carrying Distyra's own error code and detail.
 */
export async function distyraRequest<T>(params: {
  credentials: DistyraCredentials;
  path: string;
  method?: HttpMethod;
  query?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
}): Promise<T> {
  const { credentials, path, method = HttpMethod.GET, query, headers } = params;

  try {
    const response = await httpClient.sendRequest<T>({
      method,
      url: `${normalizeBaseUrl(credentials.baseUrl)}${path}`,
      authentication: {
        type: AuthenticationType.BEARER_TOKEN,
        // Trimmed: the header is built as `Bearer ${token}` verbatim, so a key
        // pasted with a trailing newline is sent as one and rejected as
        // `invalid_key` — a malformed-credential error that reads like a wrong
        // one and costs an afternoon.
        token: credentials.apiKey.trim(),
      },
      queryParams: toQueryParams(query),
      headers,
      // No automatic retry. A transactions pull spends one of the bank's four
      // unattended fetches per connection per day, so a blind retry can burn
      // the day's allowance on a request that was never going to succeed.
      retries: 0,
    });
    return response.body;
  } catch (error) {
    throw new Error(describeDistyraError(error), { cause: error });
  }
}
