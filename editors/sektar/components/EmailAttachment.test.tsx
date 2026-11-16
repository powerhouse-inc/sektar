// @vitest-environment happy-dom
// The Mail attachment pane with a PDF: the original, its Markdown once it has
// one, and the request for one, in the pane's own toolbar.
import {
  actions as emailActions,
  reducer as emailReducer,
  utils as emailUtils,
  type EmailDocument,
} from "document-models/email";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ConversionJobView,
  ConversionResult,
} from "../../../conversions/contracts.js";
import { planPublication } from "../../../conversions/model-adapter.js";
import {
  capabilities,
  MAIL_SOURCE,
  settings,
  queuedJob,
  ref,
  result,
  runningJob,
  workflowRun,
  publicationFixture,
  storedConversionBytes,
  pages,
} from "../kit/conversion-fixtures.js";
import { AttachmentPreview } from "./EmailDetail.js";
import { matchesMail, uniqueAttachments } from "../kit/mail.js";
import { emailPrintHtml } from "../kit/email-print.js";

const HOST = "https://host.example";
const STORED = vi.hoisted(() => "about:blank#");
const MARKDOWN =
  "<!-- page: 1 -->\n\n# Statement\n\nClosing balance 4,210.00 EUR\n";
let unavailableRef: string | null = null;
/** What the stored Markdown reads, when the preview fetches it. */
let served = MARKDOWN;

vi.mock("@powerhousedao/reactor-browser", () => {
  const attachments = {
    saveAttachment: () => Promise.resolve(),
    downloadBlob: ({ ref }: { ref: string }) => {
      if (ref === unavailableRef)
        throw new Error("The metadata has not arrived yet.");
      const bytes = storedConversionBytes.get(ref);
      if (!bytes) throw new Error("Missing fixture bytes");
      return Promise.resolve({
        blob: new Blob([new Uint8Array(bytes)]),
        header: { status: "available" },
      });
    },
  };
  return {
    useRenown: () => null,
    ambientRenownTokenProvider: () => Promise.resolve(undefined),
    recordBackendAuthError: () => undefined,
    useSelectedDriveSafe: () => [{ header: { id: "drive-mail" } }, undefined],
    useAttachments: () => attachments,
    useAttachmentPreview: ({ ref: wanted }: { ref?: string }) => ({
      stage: "done",
      loading: false,
      // An address the test window opens without fetching anything.
      url: wanted ? `${STORED}${wanted}` : undefined,
      error: undefined,
      header: undefined,
    }),
  };
});
vi.mock("../kit/mail-index.js", () => ({
  useMailIndexMode: () => ({ kind: "remote", base: HOST }),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/** An email of ada@example.com with a PDF and a picture attached. */
function email(): EmailDocument {
  return [
    emailActions.setAccount({ address: "Ada@Example.com" }),
    emailActions.addAttachment({
      id: "att-1",
      ref: MAIL_SOURCE.ref,
      fileName: "statement.pdf",
      mimeType: "application/pdf",
      sizeBytes: 91_000,
    }),
    emailActions.addAttachment({
      id: "att-2",
      ref: ref("ee"),
      fileName: "logo.png",
      mimeType: "image/png",
      sizeBytes: 4_000,
    }),
  ].reduce(
    (doc, action) => emailReducer(doc, action),
    emailUtils.createDocument(),
  );
}

/** The email once the host saved Markdown for its PDF attachment. */
function withMarkdown(
  doc: EmailDocument,
  over: Partial<ConversionResult> = {},
): EmailDocument {
  const source = { ...MAIL_SOURCE, documentId: doc.header.id };
  const outcome = result({
    source,
    markdown: {
      id: "artifact-md",
      role: "markdown",
      ref: ref("c3"),
      fileName: "statement.md",
      mimeType: "text/markdown",
      sizeBytes: MARKDOWN.length,
    },
    ...over,
  });
  const { manifest, artifact } = publicationFixture(outcome, MARKDOWN);
  const planned = planPublication({
    document: doc,
    manifest,
    manifestArtifact: artifact,
  });
  if (planned.kind !== "append") throw new Error("Expected new publication");
  let next = doc;
  for (const action of planned.actions) {
    if (action.type !== "ADD_ATTACHMENT")
      throw new Error("Expected Email attachment");
    next = emailReducer(next, action);
  }
  return next;
}

let container: HTMLDivElement;
let root: Root;
let asked: { method: string; url: string; body: unknown }[];
let jobs: ConversionJobView[];

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  asked = [];
  jobs = [];
  unavailableRef = null;
  served = MARKDOWN;
  vi.stubGlobal("fetch", (input: string, init?: RequestInit) => {
    if (input.startsWith(STORED)) {
      return Promise.resolve(new Response(served));
    }
    const body: unknown =
      typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    asked.push({ method: init?.method ?? "GET", url: input, body });
    const path = input.slice(
      `${HOST}/api/@powerhousedao/sektar/conversion`.length,
    );
    if (path === "/models/readiness") {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ready: true,
            files: [],
            totalBytes: 0,
            missingBytes: 0,
          }),
        ),
      );
    }
    if (path === "/models/preparations") {
      return Promise.resolve(
        new Response(JSON.stringify({ preparations: [] })),
      );
    }
    const answer = path.startsWith("/capabilities")
      ? capabilities()
      : path.startsWith("/settings")
        ? settings()
        : path.startsWith("/runs?")
          ? { jobs }
          : queuedJob({ source: MAIL_SOURCE });
    return Promise.resolve(new Response(JSON.stringify(answer)));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function show(node: ReactNode) {
  await act(async () => {
    root.render(node);
    await Promise.resolve();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const button = (name: string) =>
  [...document.querySelectorAll("button")].find(
    (candidate) =>
      candidate.textContent.trim() === name ||
      candidate.getAttribute("aria-label") === name,
  );

async function press(name: string) {
  const found = button(name);
  if (!found) throw new Error(`No button ${name}`);
  await act(async () => {
    found.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const pane = (doc: EmailDocument, attachmentId: string) => {
  const file = doc.state.global.attachments.find(
    (attachment) => attachment.id === attachmentId,
  );
  if (!file) throw new Error(`No attachment ${attachmentId}`);
  return <AttachmentPreview documentId={doc.header.id} file={file} doc={doc} />;
};

describe("a PDF attachment in Mail", () => {
  it("does not select a partial result while another saved pair is still arriving", async () => {
    const partial = withMarkdown(email(), {
      completeness: "partial",
      pages: pages(3, [3]),
    });
    await show(pane(partial, "att-1"));
    await vi.waitFor(async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(button("Markdown")).toBeDefined();
    });
    const next = withMarkdown(partial, { jobId: "second" });
    const held = next.state.global.attachments.find(
      (row) => row.id === "sektar-pdf:v1:second:manifest",
    );
    if (!held) throw new Error("Expected second manifest");
    unavailableRef = held.ref;
    await show(pane(next, "att-1"));
    expect(container.textContent).toContain(
      "Saved conversion files are still arriving.",
    );
    expect(button("Markdown")).toBeUndefined();
    expect(container.querySelector("iframe")).not.toBeNull();
    expect(button("Convert again…")?.disabled).toBe(false);
    await press("Convert again…");
    await press("Convert");
    expect(
      asked.find((call) => call.method === "POST" && call.url.endsWith("/runs"))
        ?.body,
    ).toMatchObject({
      source: {
        kind: "mail",
        documentId: next.header.id,
        attachmentId: "att-1",
        expectedRef: MAIL_SOURCE.ref,
      },
      intent: { kind: "regenerate" },
    });
  });

  it("keeps received Markdown and JSON listed, searchable and printable", () => {
    let doc = withMarkdown(email());
    for (const [id, fileName] of [
      ["received-md", "instructions.md"],
      ["received-json", "payload.json"],
    ]) {
      doc = emailReducer(
        doc,
        emailActions.addAttachment({
          id,
          fileName,
          ref: ref(id === "received-md" ? "e1" : "e2"),
        }),
      );
    }
    expect(
      uniqueAttachments(doc.state.global.attachments).map(
        (file) => file.fileName,
      ),
    ).toEqual(["statement.pdf", "logo.png", "instructions.md", "payload.json"]);
    expect(matchesMail("instructions.md", doc)).toBe(true);
    expect(matchesMail("pdf-conversion.job-1", doc)).toBe(false);
    const printed = emailPrintHtml(doc.state.global);
    expect(printed).toContain("instructions.md");
    expect(printed).toContain("payload.json");
    expect(printed).not.toContain("pdf-conversion.job-1");
  });

  it("shows the original and offers its conversion in the toolbar", async () => {
    const doc = email();
    await show(pane(doc, "att-1"));
    // The same button as in Files: a secondary button with an icon, and an arrow for other methods.
    expect(button("Convert to Markdown")?.className).toContain(
      "sk-btn--secondary",
    );
    expect(
      button("Convert to Markdown")?.querySelector(".sk-icon"),
    ).not.toBeNull();
    expect(button("More ways to convert")).toBeDefined();
    // No Markdown yet: nothing to switch to.
    expect(button("Markdown")).toBeUndefined();
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
      `${STORED}${MAIL_SOURCE.ref}`,
    );
    // The host is asked about this attachment's mailbox and this email only.
    expect(asked.map((call) => call.url)).toEqual(
      expect.arrayContaining([
        `${HOST}/api/@powerhousedao/sektar/conversion/runs?documentId=${doc.header.id}`,
        `${HOST}/api/@powerhousedao/sektar/conversion/settings`,
      ]),
    );
  });

  it("asks the host to convert exactly that attachment, at once", async () => {
    const doc = email();
    await show(pane(doc, "att-1"));
    await press("Convert to Markdown");
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(container.querySelector(".sk-toast")?.textContent).toBe(
      "Converting. You can keep working.",
    );
    const request = asked.find(
      (call) => call.method === "POST" && call.url.endsWith("/runs"),
    );
    expect(request?.url).toBe(
      `${HOST}/api/@powerhousedao/sektar/conversion/runs`,
    );
    expect(request?.body).toEqual({
      source: {
        kind: "mail",
        documentId: doc.header.id,
        attachmentId: "att-1",
        expectedRef: MAIL_SOURCE.ref,
      },
      intent: { kind: "ensure" },
    });
  });

  it("lets its Markdown be read beside the original once it has one", async () => {
    const doc = withMarkdown(email());
    await show(pane(doc, "att-1"));
    await vi.waitFor(async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(button("Markdown")).toBeDefined();
    });
    expect(button("Original")).toBeDefined();
    expect(button("Convert to Markdown")).toBeUndefined();
    expect(container.querySelector("iframe")).not.toBeNull();

    await press("Markdown");
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("h1")?.textContent).toBe("Statement");
    expect(container.textContent).toContain("Closing balance 4,210.00 EUR");
    // The toolbar keeps to one line: the switch, copy, download and a menu.
    expect(
      [
        ...(container.querySelector(".sk-preview__toolbar")?.children ?? []),
      ].map((child) => child.getAttribute("aria-label") ?? child.className),
    ).toEqual([
      "sk-segmented",
      "sk-grow",
      "Copy Markdown",
      "Download Markdown",
      "sk-menu-host",
    ]);
    // The switch stays in the toolbar to go back.
    await press("Original");
    expect(container.querySelector("iframe")).not.toBeNull();
  });

  it("opens the original at a page its Markdown is missing", async () => {
    const doc = withMarkdown(email(), {
      completeness: "partial",
      pages: pages(3, [3]),
    });
    served =
      "<!-- page: 1 -->\n\nOne\n\n<!-- page: 2 -->\n\nTwo\n\n<!-- page: 3 -->\n";
    await show(pane(doc, "att-1"));
    await vi.waitFor(async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(button("Markdown")).toBeDefined();
    });
    await press("Markdown");
    expect(container.textContent).toContain("2 of 3 pages read");
    await press("Open page 3");
    expect(container.querySelector("iframe")?.getAttribute("src")).toBe(
      `${STORED}${MAIL_SOURCE.ref}#page=3`,
    );
  });

  it("shows a conversion under way in the preview, where its Markdown will appear", async () => {
    const doc = email();
    jobs = [
      workflowRun(
        runningJob(undefined, {
          source: { ...MAIL_SOURCE, documentId: doc.header.id },
        }),
        false,
      ),
    ];
    await show(pane(doc, "att-1"));
    const row = container.querySelector(".sk-convert-pending");
    expect(row?.querySelector(".sk-file-row__name")?.textContent).toBe(
      "Markdown",
    );
    expect(row?.querySelector(".sk-file-row__meta")?.textContent).toMatch(
      /^Converting the PDF · 3 of 12 pages, started /,
    );
    expect(button("Cancel")).toBeUndefined();
    expect(button("Convert to Markdown")?.disabled).toBe(true);
  });
});

describe("an attachment that is not a PDF", () => {
  it("has no conversion, and the host is not asked about it", async () => {
    const doc = withMarkdown(email());
    await show(pane(doc, "att-2"));
    expect(container.textContent).not.toContain("Markdown");
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      `${STORED}${ref("ee")}`,
    );
    expect(asked).toEqual([]);
  });
});

it("lets another PDF convert while the first attachment request is pending", async () => {
  const doc = emailReducer(
    email(),
    emailActions.addAttachment({
      id: "att-3",
      ref: ref("e3"),
      fileName: "second.pdf",
      mimeType: "application/pdf",
    }),
  );
  const originalFetch = globalThis.fetch;
  let answer = (_response: Response) => {};
  const held = new Promise<Response>((resolve) => {
    answer = resolve;
  });
  vi.stubGlobal("fetch", (input: string, init?: RequestInit) =>
    init?.method === "POST" && input.endsWith("/runs")
      ? held
      : originalFetch(input, init),
  );
  await show(pane(doc, "att-1"));
  await press("Convert to Markdown");
  expect(button("Convert to Markdown")?.disabled).toBe(true);
  await show(pane(doc, "att-3"));
  try {
    expect(button("Convert to Markdown")?.disabled).toBe(false);
  } finally {
    answer(
      new Response(
        JSON.stringify(
          queuedJob({ source: { ...MAIL_SOURCE, documentId: doc.header.id } }),
        ),
      ),
    );
  }
});

it("does not auto-open another attachment's old Markdown because the first PDF was running", async () => {
  let doc = emailReducer(
    email(),
    emailActions.addAttachment({
      id: "att-3",
      ref: ref("e3"),
      fileName: "second.pdf",
      mimeType: "application/pdf",
    }),
  );
  doc = withMarkdown(doc, {
    source: {
      ...MAIL_SOURCE,
      documentId: doc.header.id,
      attachmentId: "att-3",
      ref: ref("e3"),
    },
  });
  jobs = [
    runningJob(undefined, {
      source: { ...MAIL_SOURCE, documentId: doc.header.id },
    }),
  ];
  await show(pane(doc, "att-1"));
  expect(container.querySelector("iframe")).not.toBeNull();
  await show(pane(doc, "att-3"));
  await vi.waitFor(
    async () => {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(button("Markdown")).toBeDefined();
    },
    { timeout: 3000 },
  );
  expect(container.querySelector("iframe")).not.toBeNull();
});

it("waits for global reading settings before applying a one-off method", async () => {
  const doc = email();
  const originalFetch = globalThis.fetch;
  let answerSettings = (_response: Response) => {};
  const heldSettings = new Promise<Response>((resolve) => {
    answerSettings = resolve;
  });
  vi.stubGlobal("fetch", (input: string, init?: RequestInit) =>
    input.endsWith("/settings") ? heldSettings : originalFetch(input, init),
  );
  await show(pane(doc, "att-1"));
  await press("More ways to convert");
  const scan = () =>
    [...document.querySelectorAll<HTMLButtonElement>("[role=menuitem]")].find(
      (el) => el.textContent.startsWith("Scan every page"),
    );
  expect(scan()?.disabled).toBe(true);
  await act(async () => {
    scan()?.click();
    await Promise.resolve();
  });
  expect(
    asked.filter(
      (call) => call.method === "POST" && call.url.endsWith("/runs"),
    ),
  ).toEqual([]);
  const globalSettings = settings({
    profile: {
      reading: {
        kind: "smart",
        fallback: { kind: "ocr", engine: "tesseract", languages: ["spa"] },
      },
      layout: { kind: "off" },
      pages: { kind: "all" },
    },
  });
  await act(async () => {
    answerSettings(new Response(JSON.stringify(globalSettings)));
    await Promise.resolve();
  });
  expect(scan()?.disabled).toBe(false);
  await act(async () => {
    scan()?.click();
    await Promise.resolve();
  });
  expect(
    asked.find((call) => call.method === "POST" && call.url.endsWith("/runs"))
      ?.body,
  ).toMatchObject({
    profile: { reading: { kind: "recognize", engine: { languages: ["spa"] } } },
  });
});
