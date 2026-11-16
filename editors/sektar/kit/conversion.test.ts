import { describe, expect, it, vi } from "vitest";
import {
  defaultConversionProfile,
  type RequestConversion,
} from "../../../conversions/contracts.js";
import {
  capabilities,
  completeJob,
  FILES_SCOPE,
  settings,
  queuedJob,
  result,
} from "./conversion-fixtures.js";
import {
  ConversionApiError,
  createConversionClient,
  isConversionMissing,
} from "./conversion.js";

type Call = { method: string; url: string; headers: Headers; body: unknown };

/** A host that answers each call in turn with a status and a JSON (or text) body. */
function host(
  ...answers: { status?: number; json?: unknown; text?: string }[]
) {
  const calls: Call[] = [];
  const unauthenticated: ConversionApiError[] = [];
  let token: string | undefined = "renown-token";
  const client = createConversionClient({
    base: "https://acme.sektar.example",
    token: () => Promise.resolve(token),
    onUnauthenticated: (error) => unauthenticated.push(error),
    fetch: (input, init) => {
      const text = typeof init?.body === "string" ? init.body : undefined;
      calls.push({
        method: init?.method ?? "GET",
        url:
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url,
        headers: new Headers(init?.headers),
        body: text === undefined ? undefined : (JSON.parse(text) as unknown),
      });
      const answer = answers.shift() ?? { status: 500, text: "no answer left" };
      return Promise.resolve(
        new Response(answer.text ?? JSON.stringify(answer.json), {
          status: answer.status ?? 200,
        }),
      );
    },
  });
  return {
    client,
    calls,
    unauthenticated,
    signOut: () => {
      token = undefined;
    },
  };
}

const API = "https://acme.sektar.example/api/@powerhousedao/sektar/conversion";

describe("the conversion client", () => {
  it("observes the same batch while its first request still waits for native runs", async () => {
    vi.useFakeTimers();
    const first = Promise.withResolvers<Response>();
    const batch = {
      id: "batch-one",
      scope: FILES_SCOPE,
      status: "running",
      jobIds: ["run-one"],
      createdAt: "2026-11-11T12:00:00.000Z",
    };
    const bodies: unknown[] = [];
    const client = createConversionClient({
      base: "https://host.example",
      token: () => Promise.resolve(undefined),
      fetch: (_url, init) => {
        bodies.push(
          JSON.parse(typeof init?.body === "string" ? init.body : "null"),
        );
        return bodies.length === 1
          ? first.promise
          : Promise.resolve(Response.json(batch));
      },
    });
    try {
      const pending = client.startBatch({
        previewId: "preview",
        requestId: "same-request",
      });
      await vi.advanceTimersByTimeAsync(1500);
      expect(await pending).toEqual(batch);
      expect(bodies).toEqual([
        { previewId: "preview", requestId: "same-request" },
        { previewId: "preview", requestId: "same-request" },
      ]);
    } finally {
      first.resolve(Response.json({ ...batch, status: "complete" }));
      vi.useRealTimers();
    }
  });
  it("asks the package's routes on the switchboard, as the signed-in user", async () => {
    const { client, calls } = host({ json: capabilities() });
    const answer = await client.capabilities();
    expect(answer.ocr.map((engine) => engine.id)).toEqual([
      "tesseract",
      "paddleocr",
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("GET");
    expect(calls[0].url).toBe(`${API}/capabilities`);
    expect(calls[0].headers.get("authorization")).toBe("Bearer renown-token");
  });

  it("asks without a bearer when nobody is signed in", async () => {
    const { client, calls, signOut } = host({ json: settings() });
    signOut();
    await client.settings();
    expect(calls[0].headers.has("authorization")).toBe(false);
  });

  it("reads the singleton settings without a source scope", async () => {
    const stored = settings();
    const { client, calls } = host({ json: stored });
    expect(await client.settings()).toEqual(stored);
    expect(calls[0].url).toBe(`${API}/settings`);
  });

  it("sends the request as asked, nothing added, and reads the job it gets back", async () => {
    const { client, calls } = host({ status: 201, json: queuedJob() });
    const request: RequestConversion = {
      source: { kind: "file", documentId: "file-1" },
      profile: defaultConversionProfile,
      intent: { kind: "regenerate", requestId: "again-1" },
    };
    const job = await client.request(request);
    expect(job.status).toBe("queued");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe(`${API}/runs`);
    expect(calls[0].headers.get("content-type")).toBe("application/json");
    // Strict on the host: an extra field such as an actor or a trigger is refused.
    expect(calls[0].body).toEqual(request);
  });

  it("stores a settings with the revision it was read at", async () => {
    const { client, calls } = host({ json: settings({ revision: 4 }) });
    const { activation, profile, limits } = settings();
    await client.putSettings({
      activation,
      profile,
      limits,
      expectedRevision: 3,
    });
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].url).toBe(`${API}/settings`);
    expect(calls[0].body).toMatchObject({
      expectedRevision: 3,
      activation: "manual",
    });
  });

  it("renews only access at the saved revision and notifies settings subscribers", async () => {
    const { client, calls } = host({ json: settings({ revision: 5 }) });
    let changed = 0;
    const stop = client.subscribeSettings(() => {
      changed += 1;
    });
    await client.renewAccess({
      expectedRevision: 4,
      workflowGrant: "app-grant",
    });
    expect(calls[0].url).toBe(`${API}/settings/access`);
    expect(calls[0].body).toEqual({
      expectedRevision: 4,
      workflowGrant: "app-grant",
    });
    expect(changed).toBe(1);
    stop();
  });

  it("addresses a document's jobs, one job, its result and its cancellation", async () => {
    const done = completeJob({ id: "job/with space" });
    const { client, calls } = host(
      { json: { jobs: [done] } },
      { json: done },
      { json: { result: result(), markdown: "# Invoice" } },
      { json: done },
    );
    expect(await client.jobs("doc id&1")).toHaveLength(1);
    await client.job("job/with space");
    expect((await client.result("job/with space")).markdown).toBe("# Invoice");
    await client.cancel("job/with space");
    expect(
      calls.map((call) => `${call.method} ${call.url.slice(API.length)}`),
    ).toEqual([
      "GET /runs?documentId=doc%20id%261",
      "GET /runs/job%2Fwith%20space",
      "GET /runs/job%2Fwith%20space/result",
      "POST /runs/job%2Fwith%20space/cancel",
    ]);
  });

  it("previews, starts, follows and cancels a batch", async () => {
    const batch = {
      id: "batch-1",
      scope: FILES_SCOPE,
      status: "running",
      jobIds: ["job-1"],
      createdAt: "2026-11-10T10:00:00.000Z",
    };
    const { client, calls } = host(
      {
        json: {
          id: "batch-1",
          scope: FILES_SCOPE,
          expiresAt: "2026-11-10T10:15:00.000Z",
          candidates: [],
          scanned: 40,
          truncated: false,
          warnings: [],
        },
      },
      { status: 201, json: batch },
      { json: { ...batch, status: "complete" } },
      { json: { ...batch, status: "cancelled" } },
    );
    expect(
      (await client.previewBatch({ scope: FILES_SCOPE, limit: 100 })).scanned,
    ).toBe(40);
    expect(
      (await client.startBatch({ previewId: "batch-1", requestId: "start-1" }))
        .status,
    ).toBe("running");
    expect((await client.batch("batch-1")).status).toBe("complete");
    expect((await client.cancelBatch("batch-1")).status).toBe("cancelled");
    expect(
      calls.map((call) => `${call.method} ${call.url.slice(API.length)}`),
    ).toEqual([
      "POST /batches/preview",
      "POST /batches",
      "GET /batches/batch-1",
      "POST /batches/batch-1/cancel",
    ]);
  });
});

describe("what the host refuses", () => {
  it("is passed on in the host's own words, with its code", async () => {
    const { client } = host({
      status: 409,
      json: {
        error: {
          code: "conversion-off",
          message: "Document conversion is off for this Files drive.",
          retryable: false,
        },
      },
    });
    const refusal = await client
      .request({
        source: { kind: "file", documentId: "file-1" },
        intent: { kind: "ensure" },
      })
      .catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(ConversionApiError);
    expect(refusal).toMatchObject({
      status: 409,
      code: "conversion-off",
      message: "Document conversion is off for this Files drive.",
    });
  });

  it("reads a refusal that carries only a message", async () => {
    const plain = host({
      status: 400,
      json: { message: "Name a documentId." },
    });
    await expect(plain.client.jobs("x")).rejects.toMatchObject({
      code: null,
      message: "Name a documentId.",
    });
    const worded = host({ status: 403, json: { error: "Forbidden" } });
    await expect(worded.client.jobs("x")).rejects.toMatchObject({
      status: 403,
      message: "You don't have permission to do that.",
      detail: "Forbidden",
    });
  });

  it("says a request it could not read in plain words, with the specifics as the detail", async () => {
    const current = host({
      status: 400,
      json: {
        error: {
          code: "invalid-request",
          message:
            "Sektar couldn't read this request. Reload the page and try again.",
          retryable: false,
          detail: "Invalid request at profile.reading.reader: Invalid option",
        },
      },
    });
    await expect(current.client.jobs("x")).rejects.toMatchObject({
      status: 400,
      code: "invalid-request",
      message:
        "Sektar couldn't read this request. Reload the page and try again.",
      detail: "Invalid request at profile.reading.reader: Invalid option",
    });
    // An older host put the field path in the message itself.
    const older = host({
      status: 400,
      json: {
        error: {
          code: "invalid-request",
          message:
            'Invalid request at profile.reading.reader: Invalid option: expected one of "pdfjs"|"mupdf"',
          retryable: false,
        },
      },
    });
    await expect(older.client.jobs("x")).rejects.toMatchObject({
      message:
        "Sektar couldn't read this request. Reload the page and try again.",
      detail:
        'Invalid request at profile.reading.reader: Invalid option: expected one of "pdfjs"|"mupdf"',
    });
  });

  it("says a failure without words of its own plainly, never by its status", async () => {
    for (const [status, message] of [
      [
        500,
        "Sektar's conversion service ran into a problem. Try again in a moment.",
      ],
      [
        502,
        "Sektar's conversion service ran into a problem. Try again in a moment.",
      ],
      [503, "Sektar is busy. Try again in a moment."],
      [429, "Sektar is busy. Try again in a moment."],
    ] as const) {
      const { client } = host({ status, text: "upstream exploded" });
      const error = await client.jobs("x").catch((e: unknown) => e);
      expect(error).toMatchObject({
        status,
        code: null,
        message,
        detail: "upstream exploded",
      });
      expect(String((error as Error).message)).not.toMatch(/\d{3}/);
    }
  });

  it("says a host it cannot reach is unreachable, and lets an abort stay an abort", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const offline = createConversionClient({
      base: "https://acme.sektar.example",
      token: () => Promise.resolve(undefined),
      fetch: () => Promise.reject(new TypeError("Failed to fetch")),
    });
    await expect(offline.jobs("x")).rejects.toMatchObject({
      name: "ConversionApiError",
      status: 0,
      code: "unreachable",
      message:
        "Sektar couldn't reach its host. Check that Sektar is running and try again.",
      detail: "Failed to fetch",
    });
    const abort = new AbortController();
    abort.abort();
    const aborted = createConversionClient({
      base: "https://acme.sektar.example",
      token: () => Promise.resolve(undefined),
      fetch: () =>
        Promise.reject(new DOMException("The user aborted.", "AbortError")),
    });
    const error = await aborted
      .jobs("x", abort.signal)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DOMException);
    expect(error).toMatchObject({ name: "AbortError" });
    warn.mockRestore();
  });

  it("knows a host without the service, even when it answers in HTML", async () => {
    const { client } = host({ status: 404, text: "<html>Cannot GET</html>" });
    const error = await client.capabilities().catch((e: unknown) => e);
    expect(isConversionMissing(error)).toBe(true);
  });

  it("tells the app when the host wants a sign-in, and only then", async () => {
    const { client, unauthenticated } = host(
      { status: 401, text: "" },
      {
        status: 403,
        json: {
          error: {
            code: "forbidden",
            message: "You do not have permission to convert this document.",
          },
        },
      },
    );
    await expect(client.settings()).rejects.toMatchObject({ status: 401 });
    expect(unauthenticated).toHaveLength(1);
    await expect(client.settings()).rejects.toMatchObject({ status: 403 });
    expect(unauthenticated).toHaveLength(1);
  });

  it("says an answer that breaks the contract means the page and host differ", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = { ...queuedJob(), status: "almost-done" };
    const { client } = host({ json: broken });
    const error = await client.job("job-1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConversionApiError);
    expect(error).toMatchObject({
      code: "incompatible-host",
      message:
        "This page and the Sektar host are on different versions. Reload the page, and if that doesn't help, restart Sektar.",
    });
    expect((error as ConversionApiError).detail).toMatch(
      /answered the conversion in a form this page does not read/,
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

it("announces host-completed settings once when any surface discovers them", async () => {
  const saved = settings();
  const preparation = {
    kind: "preparation",
    id: "saved-scanner",
    intent: {
      kind: "settings",
      settings: {
        profile: saved.profile,
        activation: saved.activation,
        limits: saved.limits,
        expectedRevision: saved.revision - 1,
      },
    },
    progress: {
      phase: "complete",
      transferredBytes: 100,
      totalBytes: 100,
      readyFiles: 1,
      totalFiles: 1,
      file: null,
    },
    updatedAt: saved.updatedAt,
    result: { kind: "settings", settings: saved },
    error: null,
  };
  const { client } = host(
    { json: { preparations: [preparation] } },
    { json: { preparations: [preparation] } },
  );
  const changed = vi.fn();
  client.subscribeSettings(changed);
  await client.preparations();
  await client.preparations();
  expect(changed).toHaveBeenCalledTimes(1);
});
