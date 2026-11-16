// @vitest-environment happy-dom
import {
  actions as fileActions,
  reducer as fileReducer,
  utils as fileUtils,
  type FileDocument,
} from "document-models/file";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversionJobView } from "../../../conversions/contracts.js";
import { withMethod } from "../../../pieces/docture/lib/profile.js";
import {
  completeJob,
  converted,
  FILE_SOURCE,
  pdfFile,
  settings,
  queuedJob,
  runningJob,
  storedConversionBytes,
} from "./conversion-fixtures.js";
import { ConversionApiError, UserFacingError } from "./conversion.js";
import {
  messageOf,
  SOMETHING_WENT_WRONG,
  useFileConversion,
  useShowFinished,
  type SourceConversion,
} from "./use-conversion.js";

// The app around the hooks: the open drive, where its index is answered from,
// and what Connect is told about a refused caller.
const app = vi.hoisted(() => ({
  drive: { header: { id: "drive-files" } } as
    | { header: { id: string } }
    | undefined,
  mode: { kind: "remote", base: "https://host.example" } as
    | { kind: "remote"; base: string }
    | { kind: "local" }
    | { kind: "unknown" },
  refused: [] as unknown[],
  /** What signing for a scope gives: a statement, none, or why it cannot */
  grant: undefined as string | Error | undefined,
  granted: [] as unknown[],
  downloadGate: null as Promise<void> | null,
  downloads: 0,
  storeRevision: 0,
  storeUnavailable: false,
}));

vi.mock("@powerhousedao/reactor-browser", () => {
  const attachments = {
    downloadBlob: async ({ ref }: { ref: string }) => {
      app.downloads += 1;
      await app.downloadGate;
      if (app.storeUnavailable)
        throw new Error("The attachment store is offline");
      const bytes = storedConversionBytes.get(ref);
      if (!bytes) throw new Error("Missing fixture bytes");
      return {
        blob: new Blob([new Uint8Array(bytes)]),
        header: { status: "available" },
      };
    },
  };
  let revision = app.storeRevision;
  let client = attachments;
  return {
    useAttachments: () => {
      if (revision !== app.storeRevision) {
        revision = app.storeRevision;
        client = { ...attachments };
      }
      return client;
    },
    useSelectedDriveSafe: () => [app.drive, undefined],
    ambientRenownTokenProvider: () => Promise.resolve("renown-token"),
    recordBackendAuthError: (error: unknown) => {
      app.refused.push(error);
      return true;
    },
  };
});
vi.mock("./mail-index.js", () => ({ useMailIndexMode: () => app.mode }));
vi.mock("./conversion-grant.js", () => ({
  useConversionGrant: (host: string | null) => (scope: unknown) => {
    if (!host) return Promise.resolve(undefined);
    app.granted.push(scope);
    return app.grant instanceof Error
      ? Promise.reject(app.grant)
      : Promise.resolve(app.grant);
  },
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** The conversion host: what it holds, and every call it got. */
const hosted = {
  settings: settings(),
  settingsStatus: 200,
  settingsRefusal: {} as unknown,
  jobs: [] as ConversionJobView[],
  jobsStatus: 200,
  calls: [] as { method: string; path: string; body: unknown }[],
  /** Set to keep a request unanswered, as a host does until the run it fired ends */
  held: null as Promise<Response> | null,
};

/** Keeps the next request unanswered until it is answered or refused here. */
function holdRequest() {
  let settle: (response: Response) => void = () => undefined;
  hosted.held = new Promise<Response>((resolve) => {
    settle = resolve;
  });
  return (status: number, json: unknown) =>
    settle(new Response(JSON.stringify(json), { status }));
}

const AT = "2026-11-10T12:00:00.000Z";
const PDF = FILE_SOURCE.ref;

/** The same File at a later revision, as a new operation leaves it. */
const revised = (doc: FileDocument, at: string): FileDocument => ({
  ...doc,
  header: { ...doc.header, lastModifiedAtUtcIso: at },
});

let host: HTMLDivElement;
let root: Root;
let seen: SourceConversion;
let shown: string[];

function Probe({ doc }: { doc: FileDocument }) {
  seen = useFileConversion(doc);
  useShowFinished(seen, (id) => shown.push(id));
  return null;
}

/** Renders, and lets the reads the render started be answered. */
async function show(doc: FileDocument) {
  await act(async () => {
    root.render(<Probe doc={doc} />);
    await vi.advanceTimersByTimeAsync(0);
  });
  await vi.waitFor(async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(seen.renditionsPending).toBe(false);
  });
}

const reads = (path: string) =>
  hosted.calls.filter(
    (call) => call.method === "GET" && call.path.startsWith(path),
  ).length;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  shown = [];
  app.drive = { header: { id: "drive-files" } };
  app.mode = { kind: "remote", base: "https://host.example" };
  app.refused = [];
  app.grant = undefined;
  app.granted = [];
  app.downloadGate = null;
  app.downloads = 0;
  app.storeRevision = 0;
  app.storeUnavailable = false;
  hosted.settings = settings();
  hosted.settingsStatus = 200;
  hosted.settingsRefusal = {};
  hosted.jobs = [];
  hosted.jobsStatus = 200;
  hosted.calls = [];
  hosted.held = null;
  vi.stubGlobal("fetch", (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const path =
      url.pathname.replace("/api/@powerhousedao/sektar/conversion", "") +
      url.search;
    const method = init?.method ?? "GET";
    const body =
      typeof init?.body === "string"
        ? (JSON.parse(init.body) as unknown)
        : undefined;
    hosted.calls.push({ method, path, body });
    const answer = (status: number, json: unknown) =>
      Promise.resolve(new Response(JSON.stringify(json), { status }));
    if (path.startsWith("/settings")) {
      return hosted.settingsStatus === 200
        ? answer(200, hosted.settings)
        : answer(hosted.settingsStatus, hosted.settingsRefusal);
    }
    if (method === "GET" && path.startsWith("/runs?"))
      return answer(hosted.jobsStatus, { jobs: hosted.jobs });
    if (method === "POST" && path === "/runs" && hosted.held) {
      return hosted.held;
    }
    if (method === "POST" && path === "/runs") {
      // The host admits the job before it answers, so the next read lists it.
      const documentId = (body as { source: { documentId: string } }).source
        .documentId;
      const job = queuedJob({
        id: "job-new",
        source: { ...FILE_SOURCE, documentId },
      });
      hosted.jobs = [job, ...hosted.jobs];
      return answer(201, job);
    }
    if (method === "POST" && path.endsWith("/cancel")) {
      const cancelled = hosted.jobs
        .filter((job) => path === `/runs/${job.id}/cancel`)
        .map((job) => ({
          ...queuedJob({ id: job.id, source: job.source }),
          status: "cancelled",
          reason: "Cancelled by you.",
        }));
      hosted.jobs = hosted.jobs.map(
        (job) => cancelled.find((done) => done.id === job.id) ?? job,
      ) as ConversionJobView[];
      return cancelled.length > 0 ? answer(200, cancelled[0]) : answer(404, {});
    }
    return answer(404, {});
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a File's conversion", () => {
  it("compares late metadata with the current PDF instead of the PDF that started the read", async () => {
    let release = () => {};
    app.downloadGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const doc = converted(pdfFile(), true);
    act(() => {
      root.render(<Probe doc={doc} />);
    });
    expect(seen.renditionsPending).toBe(true);
    const replacement = fileReducer(
      doc,
      fileActions.setAttachmentSource({
        ref: `attachment://v1:${"f".repeat(64)}`,
        fileName: "replacement.pdf",
        mimeType: "application/pdf",
        setAt: AT,
      }),
    );
    act(() => {
      root.render(<Probe doc={replacement} />);
    });
    release();
    app.downloadGate = null;
    await show(replacement);
    expect(seen.renditions).toHaveLength(1);
    expect(seen.renditions[0].stale).toBe(true);
    expect(seen.current).toBeUndefined();
  });

  it("lists Markdown only when both stored files are verified", async () => {
    const doc = pdfFile();
    await show(converted(doc, false));
    expect(seen.renditions).toEqual([]);
    expect(seen.current).toBeUndefined();

    await show(converted(doc, true));
    expect(seen.renditions.map((rendition) => rendition.status)).toEqual([
      "ready",
    ]);
    expect(seen.current?.fileName).toBe("invoice.md");
  });

  it("asks the host about a PDF and the app-wide settings", async () => {
    const doc = pdfFile();
    hosted.settings = settings({ activation: "automatic" });
    await show(doc);
    expect(hosted.calls.map((call) => call.path)).toEqual(
      expect.arrayContaining([
        `/runs?documentId=${encodeURIComponent(doc.header.id)}`,
        "/settings",
      ]),
    );
    expect(seen.activation).toMatchObject({
      kind: "known",
      activation: "automatic",
    });
    expect(seen.availability).toEqual({ kind: "ready" });
  });

  it("does not ask the host about a file that is no PDF and has no Markdown", async () => {
    const text = fileReducer(
      fileUtils.createDocument(),
      fileActions.setAttachmentSource({
        ref: PDF,
        fileName: "notes.txt",
        mimeType: "text/plain",
        setAt: AT,
      }),
    );
    await show(text);
    expect(hosted.calls).toEqual([]);
    expect(seen.jobs).toEqual([]);
  });

  it("follows a running job every two seconds and stops when it ends", async () => {
    const doc = pdfFile();
    const source = { ...FILE_SOURCE, documentId: doc.header.id };
    hosted.jobs = [runningJob(undefined, { source })];
    await show(doc);
    expect(seen.active?.status).toBe("running");
    expect(reads("/runs?")).toBe(1);

    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(reads("/runs?")).toBe(2);

    hosted.jobs = [completeJob({ source })];
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(reads("/runs?")).toBe(3);
    expect(seen.active).toBeUndefined();

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(reads("/runs?")).toBe(3);
  });

  it("asks again when the document changes", async () => {
    const doc = pdfFile();
    await show(doc);
    expect(reads("/runs?")).toBe(1);
    await show(revised(doc, "2026-11-10T13:00:00.000Z"));
    expect(reads("/runs?")).toBe(2);
  });

  it("keeps earlier PDF jobs available for details without treating them as current work", async () => {
    const doc = pdfFile();
    const old = runningJob(undefined, {
      id: "older-pdf",
      source: {
        ...FILE_SOURCE,
        documentId: doc.header.id,
        ref: `attachment://v1:${"a".repeat(64)}`,
      },
    });
    const current = completeJob({
      id: "current-pdf",
      source: { ...FILE_SOURCE, documentId: doc.header.id },
    });
    hosted.jobs = [old, current];
    await show(doc);
    expect(seen.jobs.map((job) => job.id)).toEqual(["current-pdf"]);
    expect(seen.active).toBeUndefined();
    expect(seen.historyJobs.map((job) => job.id)).toContain("older-pdf");
    await act(() => vi.advanceTimersByTimeAsync(4_000));
    expect(reads("/runs?")).toBe(1);
  });

  it("asks for a first conversion, and for a new one by name where Markdown exists", async () => {
    const doc = pdfFile();
    await show(doc);
    await act(async () => {
      await seen.request({
        profile: undefined,
        again: false,
        requestId: "unused",
      });
    });
    const profile = withMethod(settings().profile, "digital");
    await act(async () => {
      await seen.request({ profile, again: true, requestId: "again-7" });
    });
    const sent = hosted.calls.filter(
      (call) => call.method === "POST" && call.path === "/runs",
    );
    expect(sent.map((call) => call.body)).toEqual([
      {
        source: { kind: "file", documentId: doc.header.id, expectedRef: PDF },
        intent: { kind: "ensure" },
      },
      {
        source: { kind: "file", documentId: doc.header.id, expectedRef: PDF },
        profile,
        intent: { kind: "regenerate", requestId: "again-7" },
      },
    ]);
    // The job the host answered with shows at once, ahead of the next read.
    expect(seen.active?.id).toBe("job-new");
  });

  it("asks the host to stop a job and shows it stopped", async () => {
    const doc = pdfFile();
    hosted.jobs = [
      queuedJob({
        id: "job-9",
        source: { ...FILE_SOURCE, documentId: doc.header.id },
      }),
    ];
    await show(doc);
    expect(seen.active?.id).toBe("job-9");
    await act(async () => {
      await seen.cancel("job-9");
    });
    expect(
      hosted.calls.some(
        (call) => call.method === "POST" && call.path === "/runs/job-9/cancel",
      ),
    ).toBe(true);
    expect(seen.active).toBeUndefined();
    expect(seen.jobs.map((job) => job.status)).toEqual(["cancelled"]);
  });
});

describe("a request on a host that runs conversions as a person", () => {
  const sent = () =>
    hosted.calls.filter(
      (call) => call.method === "POST" && call.path === "/runs",
    );
  const ask = () =>
    seen.request({ profile: undefined, again: false, requestId: "r-1" });

  it("uses the saved global access without minting or sending a grant", async () => {
    app.grant = "signed-statement";
    await show(pdfFile());
    await act(async () => {
      await ask();
    });
    expect(app.granted).toEqual([]);
    expect(sent()).toHaveLength(1);
    expect(sent()[0].body).not.toHaveProperty("workflowGrant");
  });

  it("shows the host's setup refusal when global access has not been saved", async () => {
    await show(pdfFile());
    const answer = holdRequest();
    await act(async () => {
      const request = ask().catch(() => undefined);
      answer(409, {
        error: {
          code: "conversion-setup",
          message: "Save your app-wide settings before converting PDFs.",
        },
      });
      await request;
    });
    expect(seen.starting).toBe(false);
    expect(seen.startError).toBe(
      "Save your app-wide settings before converting PDFs.",
    );
  });
});

describe("a request the host answers late", () => {
  const ask = () => {
    const outcome = { error: null as unknown };
    act(() => {
      seen
        .request({ profile: undefined, again: false, requestId: "r-1" })
        .catch((error: unknown) => {
          outcome.error = error;
        });
    });
    return outcome;
  };

  it("reads the source's runs every two seconds meanwhile, and once more when answered", async () => {
    const doc = pdfFile();
    const source = { ...FILE_SOURCE, documentId: doc.header.id };
    await show(doc);
    expect(reads("/runs?")).toBe(1);
    const answer = holdRequest();
    ask();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(seen.starting).toBe(true);
    expect(seen.active).toBeUndefined();
    expect(reads("/runs?")).toBe(2);

    // The host lists the run it fired while the request is still open.
    hosted.jobs = [runningJob(undefined, { id: "run-1", source })];
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(reads("/runs?")).toBe(3);
    expect(seen.starting).toBe(true);
    expect(seen.active?.id).toBe("run-1");

    const done = completeJob({ id: "run-1", source });
    hosted.jobs = [done];
    await act(async () => {
      answer(201, done);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(seen.starting).toBe(false);
    expect(seen.startError).toBeNull();
    expect(seen.active).toBeUndefined();
    expect(seen.jobs.map((job) => job.status)).toEqual(["complete"]);
    const settled = reads("/runs?");
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(reads("/runs?")).toBe(settled);
  });

  it("keeps a run that is under way when the request then fails", async () => {
    const doc = pdfFile();
    const source = { ...FILE_SOURCE, documentId: doc.header.id };
    await show(doc);
    const answer = holdRequest();
    const outcome = ask();
    hosted.jobs = [runningJob(undefined, { id: "run-1", source })];
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(seen.active?.id).toBe("run-1");

    await act(async () => {
      answer(504, { error: { message: "The host took too long to answer." } });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(outcome.error).toMatchObject({
      message: "The host took too long to answer.",
    });
    expect(seen.starting).toBe(false);
    expect(seen.active?.id).toBe("run-1");
    expect(seen.startError).toBe("The host took too long to answer.");
    // The run is still followed.
    const before = reads("/runs?");
    await act(() => vi.advanceTimersByTimeAsync(2_000));
    expect(reads("/runs?")).toBe(before + 1);
  });

  it("says why nothing started, until the source gets a newer run", async () => {
    const doc = pdfFile();
    const source = { ...FILE_SOURCE, documentId: doc.header.id };
    await show(doc);
    const answer = holdRequest();
    ask();
    await act(async () => {
      answer(403, {
        error: { code: "off", message: "Conversion is off for this source." },
      });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(seen.starting).toBe(false);
    expect(seen.active).toBeUndefined();
    expect(seen.startError).toBe("Conversion is off for this source.");

    hosted.jobs = [completeJob({ id: "run-2", source })];
    await show(revised(doc, "2026-11-10T13:00:00.000Z"));
    expect(seen.startError).toBeNull();
  });

  it("shows the Markdown of a run it never saw running", async () => {
    const doc = pdfFile();
    const source = { ...FILE_SOURCE, documentId: doc.header.id };
    await show(doc);
    const answer = holdRequest();
    ask();
    const done = completeJob({ id: "run-1", source });
    hosted.jobs = [done];
    await act(async () => {
      answer(201, done);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(seen.active).toBeUndefined();
    await show(
      revised(
        converted(doc, true, { jobId: "run-1" }),
        "2026-11-10T13:00:00.000Z",
      ),
    );
    expect(shown).toEqual(["sektar-pdf:v1:run-1:markdown"]);
  });
});

describe("whether a conversion can be asked for", () => {
  it("blocks conversion when the global setting is Off", async () => {
    hosted.settings = settings({ activation: "off" });
    await show(pdfFile());
    expect(seen.availability).toEqual({
      kind: "blocked",
      reason: "Conversion is off in Settings.",
    });
  });

  it("uses the same global settings on a newly connected drive", async () => {
    hosted.settings = settings({ activation: "off" });
    await show(pdfFile());
    expect(seen.activation).toMatchObject({ kind: "known", activation: "off" });
    expect(seen.availability).toMatchObject({ kind: "blocked" });
  });

  it("refreshes every mounted source on this host after settings are saved", async () => {
    const first = pdfFile(),
      second = pdfFile();
    let surfaces: SourceConversion[] = [];
    function Sources() {
      surfaces = [useFileConversion(first), useFileConversion(second)];
      return null;
    }
    await act(async () => {
      root.render(<Sources />);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      surfaces.every(
        (surface) =>
          surface.activation.kind === "known" &&
          surface.activation.activation === "manual",
      ),
    ).toBe(true);
    hosted.settings = settings({ activation: "off", revision: 2 });
    const host = surfaces[0].host;
    if (host.kind !== "ready") throw new Error("Expected connected host");
    await act(async () => {
      await host.client.putSettings({
        activation: "off",
        profile: hosted.settings.profile,
        limits: hosted.settings.limits,
        expectedRevision: 1,
      });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      surfaces.every(
        (surface) =>
          surface.activation.kind === "known" &&
          surface.activation.activation === "off",
      ),
    ).toBe(true);
    expect(
      surfaces.every((surface) => surface.availability.kind === "blocked"),
    ).toBe(true);
  });

  it("cannot on a drive that lives in this browser only", async () => {
    app.mode = { kind: "local" };
    await show(pdfFile());
    expect(seen.availability).toMatchObject({ kind: "blocked" });
    expect(hosted.calls).toEqual([]);
    await expect(
      seen.request({ profile: undefined, again: false, requestId: "x" }),
    ).rejects.toThrow(
      "No Sektar host is connected for this drive, so it can't convert.",
    );
  });

  it("cannot on a host that has no conversion service", async () => {
    hosted.settingsStatus = 404;
    await show(pdfFile());
    expect(seen.availability).toEqual({
      kind: "blocked",
      reason: "Document conversion isn't available on this Sektar host.",
    });
  });

  it("cannot where the host says it cannot set conversion up, in its words", async () => {
    hosted.settingsStatus = 409;
    hosted.settingsRefusal = {
      error: {
        code: "managed-setup-unavailable",
        message:
          "This host limits who can read each document, so it cannot run conversions for this source.",
      },
    };
    await show(pdfFile());
    expect(seen.availability).toEqual({
      kind: "blocked",
      reason:
        "This host limits who can read each document, so it cannot run conversions for this source.",
    });
  });

  it("leaves the asking to the host when its policies answer fails without a reason", async () => {
    hosted.settingsStatus = 500;
    await show(pdfFile());
    expect(seen.availability).toEqual({ kind: "ready" });
  });

  it("tells Connect when the host wants a sign-in", async () => {
    hosted.settingsStatus = 401;
    await show(pdfFile());
    expect(app.refused).toHaveLength(1);
    expect(app.refused[0]).toMatchObject({ response: { status: 401 } });
  });
});

describe("showing a result when it is saved", () => {
  it("shows the Markdown of a conversion that ran while the view was open, once", async () => {
    const doc = pdfFile();
    hosted.jobs = [
      runningJob(undefined, {
        source: { ...FILE_SOURCE, documentId: doc.header.id },
      }),
    ];
    await show(doc);
    expect(shown).toEqual([]);
    hosted.jobs = [
      completeJob({ source: { ...FILE_SOURCE, documentId: doc.header.id } }),
    ];
    const done = revised(converted(doc, true), "2026-11-10T13:00:00.000Z");
    await show(done);
    expect(shown).toEqual(["sektar-pdf:v1:job-1:markdown"]);
    await show(revised(done, "2026-11-10T14:00:00.000Z"));
    expect(shown).toEqual(["sektar-pdf:v1:job-1:markdown"]);
  });

  it("leaves the view alone for Markdown that was already there", async () => {
    await show(converted(pdfFile(), true));
    expect(seen.current).toBeDefined();
    expect(shown).toEqual([]);
  });
});

describe("what an error says, for a person", () => {
  it("shows the words Sektar wrote, and a plain sentence for anything else", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      messageOf(new UserFacingError("Turn conversion on in Settings.", "x")),
    ).toBe("Turn conversion on in Settings.");
    expect(
      messageOf(
        new ConversionApiError(409, "conversion-off", "Conversion is off."),
      ),
    ).toBe("Conversion is off.");
    expect(warn).not.toHaveBeenCalled();
    const foreign = new Error('Invalid option: expected one of "pdfjs"');
    expect(messageOf(foreign)).toBe(SOMETHING_WENT_WRONG);
    expect(messageOf("boom", "Sektar couldn't do that.")).toBe(
      "Sektar couldn't do that.",
    );
    expect(warn).toHaveBeenCalledWith("[conversion]", foreign);
    warn.mockRestore();
  });
});

it.each(["focus", "online"])(
  "discovers retries started elsewhere on %s",
  async (event) => {
    const doc = pdfFile();
    const source = { ...FILE_SOURCE, documentId: doc.header.id };
    const failed = {
      ...queuedJob({ id: "retry-run", source }),
      status: "failed" as const,
      error: { code: "conversion-failed", message: "Failed", retryable: true },
    };
    hosted.jobs = [failed];
    await show(doc);
    expect(seen.jobs[0]?.status).toBe("failed");
    hosted.jobs = [runningJob(undefined, { id: "retry-run", source })];
    await act(() => window.dispatchEvent(new Event(event)));
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(seen.active?.status).toBe("running");
  },
);

it("recovers from an initial status read failure without a local conversion", async () => {
  const doc = pdfFile();
  const source = { ...FILE_SOURCE, documentId: doc.header.id };
  hosted.jobsStatus = 503;
  await show(doc);
  const before = reads("/runs?");
  hosted.jobsStatus = 200;
  hosted.jobs = [runningJob(undefined, { source })];
  await act(() => vi.advanceTimersByTimeAsync(6_000));
  expect(reads("/runs?")).toBeGreaterThan(before);
  expect(seen.active?.status).toBe("running");
});

it("drops old host jobs when a replicated document changes hosts", async () => {
  const doc = pdfFile();
  const source = { ...FILE_SOURCE, documentId: doc.header.id };
  hosted.jobs = [runningJob(undefined, { id: "host-a-run", source })];
  await show(doc);
  expect(seen.active?.id).toBe("host-a-run");
  app.mode = { kind: "remote", base: "https://host-b.example" };
  hosted.jobsStatus = 503;
  await show(doc);
  expect(seen.host.kind === "ready" && seen.host.client.host).toBe(
    "https://host-b.example",
  );
  expect(seen.jobsError).not.toBeNull();
  expect(seen.active).toBeUndefined();
  expect(seen.historyJobs).toEqual([]);
});

it("does not carry a pending request to another host for the same PDF", async () => {
  const doc = pdfFile();
  await show(doc);
  const answer = holdRequest();
  await act(async () => {
    void seen.request({
      profile: undefined,
      again: false,
      requestId: "host-a-request",
    });
    await Promise.resolve();
  });
  expect(seen.starting).toBe(true);
  app.mode = { kind: "remote", base: "https://host-b.example" };
  await show(doc);
  expect(seen.starting).toBe(false);
  await act(async () => {
    answer(
      200,
      queuedJob({
        id: "old-host-run",
        source: { ...FILE_SOURCE, documentId: doc.header.id },
      }),
    );
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(seen.jobs).toEqual([]);
});

it("does not auto-open a delayed earlier result while a newer conversion is still running", async () => {
  const doc = converted(pdfFile(), true);
  const source = { ...FILE_SOURCE, documentId: doc.header.id };
  hosted.jobs = [runningJob(undefined, { id: "new-run", source })];
  let release = () => {};
  app.downloadGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await act(async () => {
    root.render(<Probe doc={doc} />);
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(seen.active?.id).toBe("new-run");
  expect(seen.current).toBeUndefined();
  release();
  app.downloadGate = null;
  await show(doc);
  expect(seen.current).toBeDefined();
  expect(seen.active?.id).toBe("new-run");
  expect(shown).toEqual([]);
});

it.each(["host", "attachment service"])(
  "rechecks saved files when the %s changes",
  async (changed) => {
    const doc = converted(pdfFile(), true);
    await show(doc);
    expect(seen.current).toBeDefined();
    const before = app.downloads;
    if (changed === "host")
      app.mode = { kind: "remote", base: "https://host-b.example" };
    else app.storeRevision += 1;
    app.storeUnavailable = true;
    await act(async () => {
      root.render(<Probe doc={doc} />);
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(app.downloads).toBeGreaterThan(before);
    expect(seen.renditionsPending).toBe(true);
    expect(seen.current).toBeUndefined();
  },
);
