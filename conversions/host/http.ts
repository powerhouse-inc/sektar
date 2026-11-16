import {
  inspectModelsSchema,
} from "../models/contracts.js";
// The /conversion HTTP API on the package's route scope
// (`/api/@powerhousedao/sektar/conversion/...`). The caller comes from the
// verified bearer; no body field can name an actor or a trigger.
import type {
  IHttpScope,
  RouteContext,
  ScopedRouteHandle,
} from "@powerhousedao/shared/processors";
import type { z } from "zod";
import {
  conversionApiPrefix,
  previewConversionBatchSchema,
  putConversionSettingsSchema,
  renewConversionAccessSchema,
  requestConversionBatchSchema,
  requestConversionSchema,
} from "../contracts.js";
import { ConversionRefusal, starting } from "./problems.js";
import { callerOf, type ConversionService } from "./service.js";
import { WorkflowRuntimeError } from "../workflow/bridge.js";

const MAX_BODY_BYTES = 256 * 1024;
const BASE = conversionApiPrefix.replace(/^\/+/, "");

function reply(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function refusalResponse(refusal: ConversionRefusal): Response {
  return reply(refusal.status, { error: refusal.problem });
}

/** A request this host cannot read: usually a page from another version of Sektar. */
const UNREADABLE_REQUEST =
  "Sektar couldn't read this request. Reload the page and try again.";

function unreadable(
  request: Request,
  code: "invalid-json" | "invalid-request",
  detail: string,
): ConversionRefusal {
  console.warn(
    `[conversion] Refused ${request.method} ${new URL(request.url).pathname}: ${detail}`,
  );
  return new ConversionRefusal(400, code, UNREADABLE_REQUEST, false, detail);
}

async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw unreadable(request, "invalid-json", "The request body is not JSON.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues.at(0);
    throw unreadable(
      request,
      "invalid-request",
      issue
        ? `Invalid request at ${issue.path.join(".") || "body"}: ${issue.message}`
        : "Invalid request.",
    );
  }
  return parsed.data;
}

type Handler = (
  request: Request,
  context: RouteContext,
  service: ConversionService,
) => Promise<Response>;

/** Registers every route; until the service is ready they answer 503. */
export function registerConversionRoutes(
  http: IHttpScope,
  service: () => ConversionService | null,
  onError: (error: unknown) => void,
): ScopedRouteHandle[] {
  const handle =
    (handler: Handler) =>
    async (request: Request, context: RouteContext): Promise<Response> => {
      const ready = service();
      if (!ready) return refusalResponse(starting());
      try {
        return await handler(request, context, ready);
      } catch (error) {
        if (error instanceof ConversionRefusal) return refusalResponse(error);
        if (error instanceof WorkflowRuntimeError) {
          const [status, message] =
            error.code === "unauthenticated"
              ? ([401, "Sign in to Sektar again, then try again."] as const)
              : error.code === "forbidden"
                ? ([
                    403,
                    "You don't have permission to run this conversion.",
                  ] as const)
                : ([
                    503,
                    "Sektar's conversion service ran into a problem. Try again in a moment.",
                  ] as const);
          return reply(status, {
            error: {
              code: `workflow-${error.code}`,
              message,
              retryable: false,
              detail: error.message,
            },
          });
        }
        onError(error);
        return reply(500, {
          error: {
            code: "internal",
            message:
              "Sektar's conversion service ran into a problem. Try again in a moment.",
            retryable: true,
          },
        });
      }
    };
  const caller = (context: RouteContext) => callerOf(context.user?.address);
  const param = (context: RouteContext, name: string) => {
    const value = context.params[name];
    if (!value)
      throw new ConversionRefusal(
        400,
        "invalid-request",
        UNREADABLE_REQUEST,
        false,
        `Missing ${name}.`,
      );
    return value;
  };
  const route = (
    method: "GET" | "POST" | "PUT",
    path: string,
    handler: Handler,
    withBody = false,
  ) =>
    http.route({
      method,
      path: `${BASE}/${path}`,
      auth: "renown",
      ...(withBody
        ? { maxBodyBytes: MAX_BODY_BYTES }
        : { body: "none" as const }),
      handler: handle(handler),
    });

  return [
    route(
      "POST",
      "models/readiness",
      async (request, context, svc) =>
        reply(
          200,
          await svc.modelReadiness(
            caller(context),
            (await body(request, inspectModelsSchema)).profile,
          ),
        ),
      true,
    ),
    route("GET", "models/preparations", async (_request, context, svc) =>
      reply(200, { preparations: await svc.preparations(caller(context)) }),
    ),
    route("GET", "models/preparations/:id", async (_request, context, svc) =>
      reply(200, await svc.preparation(caller(context), param(context, "id"))),
    ),
    route("GET", "capabilities", async (request, context, svc) =>
      reply(200, await svc.capabilities(caller(context))),
    ),
    route("GET", "settings", async (_request, context, svc) =>
      reply(200, await svc.settings(caller(context))),
    ),
    route(
      "PUT",
      "settings",
      async (request, context, svc) =>
        reply(
          200,
          await svc.putSettings(
            caller(context),
            await body(request, putConversionSettingsSchema),
          ),
        ),
      true,
    ),
    route(
      "POST",
      "settings/access",
      async (request, context, svc) =>
        reply(
          200,
          await svc.renewAccess(
            caller(context),
            await body(request, renewConversionAccessSchema),
          ),
        ),
      true,
    ),
    route(
      "POST",
      "runs",
      async (request, context, svc) => {
        const { view, created } = await svc.request(
          caller(context),
          await body(request, requestConversionSchema),
          request.headers.get("authorization") ?? undefined,
        );
        return reply(created ? 201 : 200, view);
      },
      true,
    ),
    route("GET", "runs", async (request, context, svc) => {
      const documentId = new URL(request.url).searchParams.get("documentId");
      if (!documentId)
        throw unreadable(request, "invalid-request", "Name a documentId.");
      return reply(200, {
        jobs: await svc.jobs(
          caller(context),
          documentId,
          request.headers.get("authorization") ?? undefined,
        ),
      });
    }),
    route("GET", "runs/:id", async (request, context, svc) =>
      reply(
        200,
        await svc.job(
          caller(context),
          param(context, "id"),
          request.headers.get("authorization") ?? undefined,
        ),
      ),
    ),
    route("POST", "runs/:id/cancel", async (request, context, svc) =>
      reply(
        200,
        await svc.cancel(
          caller(context),
          param(context, "id"),
          request.headers.get("authorization") ?? undefined,
        ),
      ),
    ),
    route("GET", "runs/:id/result", async (request, context, svc) =>
      reply(
        200,
        await svc.result(
          caller(context),
          param(context, "id"),
          request.headers.get("authorization") ?? undefined,
        ),
      ),
    ),
    route(
      "POST",
      "batches/preview",
      async (request, context, svc) =>
        reply(
          200,
          await svc.previewBatch(
            caller(context),
            await body(request, previewConversionBatchSchema),
          ),
        ),
      true,
    ),
    route(
      "POST",
      "batches",
      async (request, context, svc) =>
        reply(
          201,
          await svc.createBatch(
            caller(context),
            await body(request, requestConversionBatchSchema),
            request.headers.get("authorization") ?? undefined,
          ),
        ),
      true,
    ),
    route("GET", "batches/:id", async (request, context, svc) =>
      reply(
        200,
        await svc.batch(
          caller(context),
          param(context, "id"),
          request.headers.get("authorization") ?? undefined,
        ),
      ),
    ),
    route("POST", "batches/:id/cancel", async (request, context, svc) =>
      reply(
        200,
        await svc.cancelBatch(
          caller(context),
          param(context, "id"),
          request.headers.get("authorization") ?? undefined,
        ),
      ),
    ),
  ];
}
