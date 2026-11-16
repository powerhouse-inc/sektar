import type {
  IHttpScope,
  RouteContext,
  RouteSpec,
  ScopedRouteHandle,
} from "@powerhousedao/shared/processors";
import { describe, expect, it, vi } from "vitest";
import { registerConversionRoutes } from "./http.js";
import { ConversionRefusal } from "./problems.js";
import { WorkflowRuntimeError } from "../workflow/bridge.js";
import type { Caller, ConversionService } from "./service.js";

function scope() {
  const routes: RouteSpec[] = [];
  const http = {
    route: (spec: RouteSpec): ScopedRouteHandle => {
      routes.push(spec);
      return { url: spec.path, dispose: () => undefined };
    },
  };
  const call = async (
    method: string,
    path: string,
    init: {
      body?: unknown;
      user?: string;
      params?: Record<string, string>;
      query?: string;
    } = {},
  ) => {
    const spec = routes.find(
      (route) =>
        route.path === path &&
        (Array.isArray(route.method)
          ? route.method.includes(method as never)
          : route.method === method),
    );
    if (!spec) throw new Error(`No route ${method} ${path}`);
    const request = new Request(
      `http://host/api/@powerhousedao/sektar/${path}${init.query ?? ""}`,
      {
        method,
        ...(init.body === undefined
          ? {}
          : {
              body:
                typeof init.body === "string"
                  ? init.body
                  : JSON.stringify(init.body),
              headers: { "content-type": "application/json" },
            }),
      },
    );
    const context = {
      params: init.params ?? {},
      user: init.user
        ? {
            address: init.user,
            chainId: 1,
            networkId: "eip155",
            appKey: "did:key:app",
          }
        : undefined,
      authEnabled: true,
      rawBody: undefined,
      signal: new AbortController().signal,
      transport: {
        proto: "http",
        host: "host",
        prefix: "",
        baseUrl: "http://host",
      },
    } satisfies RouteContext;
    const response = await spec.handler(request, context);
    return {
      status: response.status,
      body: (await response.json()) as unknown,
    };
  };
  return { http: http as unknown as IHttpScope, routes, call };
}

describe("the /conversion routes", () => {
  it.each([
    ["unauthenticated", 401],
    ["forbidden", 403],
  ] as const)("preserves the native %s refusal", async (code, status) => {
    const { http, call } = scope();
    registerConversionRoutes(
      http,
      () =>
        ({
          capabilities: () =>
            Promise.reject(new WorkflowRuntimeError(code, "Sign in again.")),
        }) as unknown as ConversionService,
      () => undefined,
    );
    expect(await call("GET", "conversion/capabilities")).toMatchObject({
      status,
      body: { error: { code: `workflow-${code}`, retryable: false } },
    });
  });
  it("serve every documented route on the package scope, behind sign-in", () => {
    const { http, routes } = scope();
    registerConversionRoutes(
      http,
      () => null,
      () => undefined,
    );
    expect(
      routes.map((route) => `${String(route.method)} ${route.path}`),
    ).toEqual([
      "POST conversion/models/readiness",
      "GET conversion/models/preparations",
      "GET conversion/models/preparations/:id",
      "GET conversion/capabilities",
      "GET conversion/settings",
      "PUT conversion/settings",
      "POST conversion/settings/access",
      "POST conversion/runs",
      "GET conversion/runs",
      "GET conversion/runs/:id",
      "POST conversion/runs/:id/cancel",
      "GET conversion/runs/:id/result",
      "POST conversion/batches/preview",
      "POST conversion/batches",
      "GET conversion/batches/:id",
      "POST conversion/batches/:id/cancel",
    ]);
    expect(new Set(routes.map((route) => route.auth))).toEqual(
      new Set(["renown"]),
    );
  });

  it("answer 503 until the service is ready", async () => {
    const { http, call } = scope();
    registerConversionRoutes(
      http,
      () => null,
      () => undefined,
    );
    expect(await call("GET", "conversion/capabilities")).toEqual({
      status: 503,
      body: {
        error: {
          code: "starting",
          message: expect.any(String) as string,
          retryable: true,
        },
      },
    });
  });

  it("take the caller from the verified token, never from the body, and answer refusals as problems", async () => {
    const { http, call } = scope();
    const seen: Caller[] = [];
    const service = {
      request: (caller: Caller) => {
        seen.push(caller);
        return Promise.reject(
          new ConversionRefusal(
            409,
            "conversion-off",
            "Document conversion is off for this Files drive.",
            false,
          ),
        );
      },
      settings: (caller: Caller) => {
        seen.push(caller);
        return Promise.resolve({ activation: "manual" });
      },
    } as unknown as ConversionService;
    registerConversionRoutes(
      http,
      () => service,
      () => undefined,
    );

    const body = { source: { kind: "file", documentId: "doc-1" } };
    expect(
      await call("POST", "conversion/runs", { body, user: "0xABC" }),
    ).toMatchObject({
      status: 409,
      body: { error: { code: "conversion-off", retryable: false } },
    });
    expect(seen.at(-1)).toEqual({ identity: "0xabc", address: "0xABC" });

    expect(
      (
        await call("POST", "conversion/runs", {
          body: { ...body, trigger: "automatic" },
          user: "0xabc",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("POST", "conversion/runs", {
          body: { ...body, actor: "0xadmin" },
          user: "0xabc",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call("POST", "conversion/runs", {
          body: "{not json",
          user: "0xabc",
        })
      ).body,
    ).toMatchObject({ error: { code: "invalid-json" } });

    expect(await call("GET", "conversion/settings")).toEqual({
      status: 200,
      body: { activation: "manual" },
    });
    expect(seen.at(-1)).toEqual({ identity: "anonymous", address: undefined });
  });

  it("refuse a body they cannot read in plain words, with the specifics as the detail", async () => {
    const { http, call } = scope();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    registerConversionRoutes(
      http,
      () => ({}) as unknown as ConversionService,
      () => undefined,
    );
    const answer = await call("POST", "conversion/runs", {
      body: {
        source: { kind: "file", documentId: "doc-1" },
        profile: {
          reading: { kind: "telepathy" },
          layout: { kind: "off" },
          pages: { kind: "all" },
        },
      },
      user: "0xabc",
    });
    expect(answer).toMatchObject({
      status: 400,
      body: {
        error: {
          code: "invalid-request",
          message:
            "Sektar couldn't read this request. Reload the page and try again.",
          retryable: false,
          detail: expect.stringMatching(
            /^Invalid request at profile/,
          ) as string,
        },
      },
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\[conversion\] Refused POST .*conversion\/runs: Invalid request at profile/,
      ),
    );
    expect(
      (
        await call("POST", "conversion/runs", {
          body: "{not json",
          user: "0xabc",
        })
      ).body,
    ).toEqual({
      error: {
        code: "invalid-json",
        message:
          "Sektar couldn't read this request. Reload the page and try again.",
        retryable: false,
        detail: "The request body is not JSON.",
      },
    });
    warn.mockRestore();
  });

  it("say a workflow runtime failure plainly, keeping its own words as the detail", async () => {
    const { http, call } = scope();
    registerConversionRoutes(
      http,
      () =>
        ({
          cancel: () =>
            Promise.reject(
              new WorkflowRuntimeError(
                "graphql",
                "Cancelling a RUNNING run is not supported yet (#3226)",
              ),
            ),
        }) as unknown as ConversionService,
      () => undefined,
    );
    expect(
      await call("POST", "conversion/runs/:id/cancel", {
        params: { id: "run-1" },
      }),
    ).toEqual({
      status: 503,
      body: {
        error: {
          code: "workflow-graphql",
          message:
            "Sektar's conversion service ran into a problem. Try again in a moment.",
          retryable: false,
          detail: "Cancelling a RUNNING run is not supported yet (#3226)",
        },
      },
    });
  });

  it("hide unexpected failures behind a generic answer", async () => {
    const { http, call } = scope();
    const errors: unknown[] = [];
    registerConversionRoutes(
      http,
      () =>
        ({
          capabilities: () =>
            Promise.reject(new Error("database is down: password=hunter2")),
        }) as unknown as ConversionService,
      (error) => errors.push(error),
    );
    const answer = await call("GET", "conversion/capabilities");
    expect(answer).toMatchObject({
      status: 500,
      body: { error: { code: "internal", retryable: true } },
    });
    expect(JSON.stringify(answer.body)).not.toContain("hunter2");
    expect(errors).toHaveLength(1);
  });
});
