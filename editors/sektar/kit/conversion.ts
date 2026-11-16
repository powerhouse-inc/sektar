import {
  modelReadinessSchema,
  modelPreparationSchema,
  preparationListSchema,
  saveSettingsResponseSchema,
  type ModelPreparation,
} from "../../../conversions/models/contracts.js";
import type { ConversionProfile } from "../../../conversions/contracts.js";
// The browser's client for the host conversion service: the calls of
// conversions/contracts.ts over HTTP, as the signed-in user. A conversion is
// a workflow run on the host; the host answers about one in the job view of
// the contract, whose id is the run's. What the host answers is parsed with
// the shared schemas where it crosses into the app; a refusal, an answer this
// page cannot read and a host it cannot reach each become a ConversionApiError
// whose message a person can act on.
//
// Nothing here knows React or the reactor: kit/use-conversion.ts binds a
// client to the switchboard behind the open drive and to the user's token.
import { z } from "zod";
import {
  conversionApiPrefix,
  conversionBatchPreviewSchema,
  conversionBatchSchema,
  conversionCapabilitiesSchema,
  conversionJobViewSchema,
  conversionJobsResponseSchema,
  conversionSettingsSchema,
  conversionResultResponseSchema,
  type ConversionBatch,
  type ConversionBatchPreview,
  type ConversionCapabilities,
  type ConversionJobView,
  type ConversionSettings,
  type ConversionResultResponse,
  type PreviewConversionBatch,
  type PutConversionSettings,
  type RenewConversionAccess,
  type RequestConversion,
  type RequestConversionBatch,
} from "../../../conversions/contracts.js";

/**
 * Where a switchboard serves this package's own routes, below its base: the
 * conversion plugin registers its API on that scope
 * (conversions/host/http.ts), as the reconciler does its runner route.
 */
export const SEKTAR_ROUTE_SCOPE = "/api/@powerhousedao/sektar";

/** How a client reaches one host. */
export interface ConversionHttp {
  /** The switchboard's origin and base path, without a trailing slash */
  base: string;
  fetch: typeof globalThis.fetch;
  /** The signed-in user's bearer; none sends the request anonymously */
  token: () => Promise<string | undefined>;
  /** Told when the host refused the caller as not signed in (401) */
  onUnauthenticated?: (error: ConversionApiError) => void;
}

/**
 * An error whose message Sektar wrote for the person using it: a plain
 * sentence that says what happened and what to do. `detail` holds what a
 * developer needs and is never the main text. Only these errors' messages are
 * shown (kit/use-conversion.ts `messageOf`).
 */
export class UserFacingError extends Error {
  override name = "UserFacingError";
  constructor(
    message: string,
    readonly detail?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/**
 * The host answered a call with a refusal or a failure, or could not be
 * reached or read.
 */
export class ConversionApiError extends UserFacingError {
  override name = "ConversionApiError";
  constructor(
    /** The HTTP status the host answered with; 0 when it never answered or its answer could not be read */
    readonly status: number,
    /** The host's machine-readable code, or the client's own for a host it could not reach or read */
    readonly code: string | null,
    message: string,
    detail?: string,
  ) {
    super(message, detail);
  }
}

const UNREADABLE_REQUEST =
  "Sektar couldn't read this request. Reload the page and try again.";
const INCOMPATIBLE_HOST =
  "This page and the Sektar host are on different versions. Reload the page, and if that doesn't help, restart Sektar.";
const UNREACHABLE =
  "Sektar couldn't reach its host. Check that Sektar is running and try again.";

/**
 * Whether the host has no conversion service at all (an older host, or one
 * without the plugin). Only meaningful for a call every conversion host
 * answers, such as its capabilities: a 404 for one run means that run.
 */
export function isConversionMissing(error: unknown): boolean {
  return error instanceof ConversionApiError && error.status === 404;
}

/** Whether a write lost to a newer one: the policy changed since it was read. */
export function isConversionConflict(error: unknown): boolean {
  return error instanceof ConversionApiError && error.status === 409;
}

/**
 * The forms a refusal's body takes, most specific first: the service's own
 * problem (`{ error: { code, message } }`), the same fields at the root, or
 * a bare message.
 */
const problemSchema = z.object({
  code: z.string().optional(),
  message: z.string().min(1),
  detail: z.string().optional(),
});
const refusalSchema = z.union([
  z.object({ error: problemSchema }),
  problemSchema,
  z.object({ error: z.string().min(1) }),
]);

interface Refusal {
  code: string | null;
  /** Absent when the body carried no message written for people */
  message?: string;
  detail?: string;
}

function refusalOf(body: unknown): Refusal | null {
  const parsed = refusalSchema.safeParse(body);
  if (!parsed.success) return null;
  const refusal = parsed.data;
  if ("message" in refusal) return plainRefusal(refusal);
  // A bare string comes from something in front of the conversion service,
  // in its own words: keep them for support only.
  return typeof refusal.error === "string"
    ? { code: null, detail: refusal.error }
    : plainRefusal(refusal.error);
}

function plainRefusal(problem: z.infer<typeof problemSchema>): Refusal {
  const refused: Refusal = {
    code: problem.code ?? null,
    message: problem.message,
    ...(problem.detail ? { detail: problem.detail } : {}),
  };
  // A host older than this page names the field it could not read in the
  // message itself; that text belongs in the detail.
  if (refused.code === "invalid-request" || refused.code === "invalid-json")
    return {
      ...refused,
      message: UNREADABLE_REQUEST,
      detail: problem.detail ?? problem.message,
    };
  return refused;
}

function statusMessage(status: number): string {
  if (status === 401) return "Sign in to Sektar to convert documents.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404)
    return "Document conversion isn't available on this Sektar host.";
  if (status === 429 || status === 503)
    return "Sektar is busy. Try again in a moment.";
  if (status >= 500)
    return "Sektar's conversion service ran into a problem. Try again in a moment.";
  if (status === 400) return UNREADABLE_REQUEST;
  return "Sektar couldn't do that. Reload the page and try again.";
}

function isAbort(error: unknown, signal?: AbortSignal): boolean {
  return (
    signal?.aborted === true ||
    (error instanceof Error && error.name === "AbortError")
  );
}

type Method = "GET" | "POST" | "PUT";

async function send(
  http: ConversionHttp,
  method: Method,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  const token = await http.token();
  const url = `${http.base}${SEKTAR_ROUTE_SCOPE}${conversionApiPrefix}${path}`;
  let response: Response;
  let text: string;
  try {
    response = await http.fetch(url, {
      method,
      headers: {
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    });
    text = await response.text();
  } catch (error) {
    if (isAbort(error, signal) || !(error instanceof TypeError)) throw error;
    console.warn(
      `[conversion] ${method} ${path} did not reach the host`,
      error,
    );
    throw new ConversionApiError(0, "unreachable", UNREACHABLE, error.message);
  }
  let json: unknown;
  try {
    json = text === "" ? undefined : JSON.parse(text);
  } catch {
    json = undefined;
  }
  if (response.ok) return json;
  const refusal = refusalOf(json);
  const error = new ConversionApiError(
    response.status,
    refusal?.code ?? null,
    refusal?.message ?? statusMessage(response.status),
    refusal?.detail ?? (text.trim().slice(0, 500) || undefined),
  );
  if (response.status === 401) http.onUnauthenticated?.(error);
  throw error;
}

/**
 * Reads an answer as the contract defines it. Anything else means this page
 * and the host disagree about the contract, which a reload or a restart fixes.
 */
function read<T>(schema: z.ZodType<T>, what: string, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data;
  const detail = `The host answered ${what} in a form this page does not read: ${z.prettifyError(parsed.error)}`;
  console.warn(`[conversion] ${detail}`);
  throw new ConversionApiError(
    0,
    "incompatible-host",
    INCOMPATIBLE_HOST,
    detail,
  );
}

const segment = encodeURIComponent;

/** The conversion service of one host, as the signed-in user. */
export function createConversionClient(http: ConversionHttp) {
  const subscribers = new Set<() => void>();
  const changed = () => {
    for (const notify of subscribers) notify();
  };
  let observedSettingsRevision = -1;
  const observePreparation = (view: ModelPreparation) => {
    if (
      !view.result ||
      view.result.settings.revision <= observedSettingsRevision
    )
      return;
    observedSettingsRevision = view.result.settings.revision;
    changed();
  };
  return {
    subscribeSettings(notify: () => void): () => void {
      subscribers.add(notify);
      return () => {
        subscribers.delete(notify);
      };
    },
    /** The switchboard this client asks */
    host: http.base,

    /** The engines this host can actually run, with a setup reason for each it cannot, and its limits. */
    async capabilities(signal?: AbortSignal): Promise<ConversionCapabilities> {
      return read(
        conversionCapabilitiesSchema,
        "its capabilities",
        await send(http, "GET", "/capabilities", undefined, signal),
      );
    },

    async settings(signal?: AbortSignal): Promise<ConversionSettings> {
      return read(
        conversionSettingsSchema,
        "the conversion settings",
        await send(http, "GET", "/settings", undefined, signal),
      );
    },
    async putSettings(settings: PutConversionSettings) {
      const result = read(
        saveSettingsResponseSchema,
        "the scanner setup",
        await send(http, "PUT", "/settings", settings),
      );
      changed();
      return result;
    },
    async modelReadiness(profile: ConversionProfile, signal?: AbortSignal) {
      return read(
        modelReadinessSchema,
        "scanner files",
        await send(http, "POST", "/models/readiness", { profile }, signal),
      );
    },
    async preparations(signal?: AbortSignal) {
      const preparations = read(
        preparationListSchema,
        "scanner downloads",
        await send(http, "GET", "/models/preparations", undefined, signal),
      ).preparations;
      for (const view of preparations) observePreparation(view);
      return preparations;
    },
    async preparation(id: string, signal?: AbortSignal) {
      const result = read(
        modelPreparationSchema,
        "scanner download",
        await send(
          http,
          "GET",
          `/models/preparations/${segment(id)}`,
          undefined,
          signal,
        ),
      );
      observePreparation(result);
      return result;
    },
    async renewAccess(input: RenewConversionAccess): Promise<void> {
      await send(http, "POST", "/settings/access", input);
      changed();
    },

    /**
     * Asks for a conversion. The host may answer only once the workflow run
     * it starts has been fired, which can be as late as the run's end: an
     * unanswered request is no sign that nothing is running, so read `jobs`
     * meanwhile.
     */
    async request(request: RequestConversion): Promise<ConversionJobView> {
      return read(
        conversionJobViewSchema,
        "the conversion request",
        await send(http, "POST", "/runs", request),
      );
    },

    /** The runs of one owner document that this user may see. */
    async jobs(
      documentId: string,
      signal?: AbortSignal,
    ): Promise<ConversionJobView[]> {
      return read(
        conversionJobsResponseSchema,
        "the conversions of this document",
        await send(
          http,
          "GET",
          `/runs?documentId=${segment(documentId)}`,
          undefined,
          signal,
        ),
      ).jobs;
    },

    async job(id: string, signal?: AbortSignal): Promise<ConversionJobView> {
      return read(
        conversionJobViewSchema,
        "the conversion",
        await send(http, "GET", `/runs/${segment(id)}`, undefined, signal),
      );
    },

    /**
     * Cancels a run the host says can be cancelled: one that has not started
     * running. The host refuses it for a run that is running.
     */
    async cancel(id: string): Promise<ConversionJobView> {
      return read(
        conversionJobViewSchema,
        "the cancellation",
        await send(http, "POST", `/runs/${segment(id)}/cancel`),
      );
    },

    /** A finalized run's result and its Markdown. */
    async result(
      id: string,
      signal?: AbortSignal,
    ): Promise<ConversionResultResponse> {
      return read(
        conversionResultResponseSchema,
        "the conversion result",
        await send(
          http,
          "GET",
          `/runs/${segment(id)}/result`,
          undefined,
          signal,
        ),
      );
    },

    /** Which stored PDFs of a source a batch would convert. Starts nothing. */
    async previewBatch(
      input: PreviewConversionBatch,
    ): Promise<ConversionBatchPreview> {
      return read(
        conversionBatchPreviewSchema,
        "the batch preview",
        await send(http, "POST", "/batches/preview", input),
      );
    },

    /** Starts the batch a preview described. */
    async startBatch(input: RequestConversionBatch): Promise<ConversionBatch> {
      const first = send(http, "POST", "/batches", input);
      let timer: ReturnType<typeof setTimeout> | undefined;
      // Repeating this request ID only reads the stored batch. Native fire
      // waits until completion, so observe the batch while that call waits.
      const observed = new Promise<unknown>((resolve) => {
        timer = setTimeout(
          () =>
            resolve(send(http, "POST", "/batches", input).catch(() => first)),
          1500,
        );
      });
      try {
        return read(
          conversionBatchSchema,
          "the batch",
          await Promise.race([first, observed]),
        );
      } finally {
        clearTimeout(timer);
      }
    },

    /** How a batch stands: running until its last conversion ends. */
    async batch(id: string, signal?: AbortSignal): Promise<ConversionBatch> {
      return read(
        conversionBatchSchema,
        "the batch",
        await send(http, "GET", `/batches/${segment(id)}`, undefined, signal),
      );
    },

    async cancelBatch(id: string): Promise<ConversionBatch> {
      return read(
        conversionBatchSchema,
        "the batch cancellation",
        await send(http, "POST", `/batches/${segment(id)}/cancel`),
      );
    },
  };
}

export type ConversionClient = ReturnType<typeof createConversionClient>;
