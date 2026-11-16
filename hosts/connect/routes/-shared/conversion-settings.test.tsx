// @vitest-environment happy-dom
import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ConversionBatch,
  ConversionBatchPreview,
  ConversionSettings as Settings,
  ConversionScope,
  PutConversionSettings,
} from "../../../../conversions/contracts.js";
import { normalizeAccount } from "../../../../conversions/host/sources.js";
import type { ModelPreparation } from "../../../../conversions/models/contracts.js";
import {
  capabilities,
  FILE_SOURCE,
  FILES_SCOPE,
  HOST_LIMITS,
  settings,
} from "../../../../editors/sektar/kit/conversion-fixtures.js";
import {
  mailAccountKey,
  scopeKey,
} from "../../../../editors/sektar/kit/conversion-model.js";
import {
  ConversionApiError,
  createConversionClient,
  UserFacingError,
  type ConversionClient,
} from "../../../../editors/sektar/kit/conversion.js";
import { withRecognition } from "../../../../pieces/docture/lib/profile.js";
import { batchText, previewText } from "./conversion-batches.js";
import {
  ConversionSettings,
  ConversionSettingsForm,
} from "./conversion-settings.js";
import { sourcesOf } from "./conversion-sources.js";

const app = vi.hoisted(() => ({
  drives: undefined as unknown[] | undefined,
  mode: { kind: "unknown" } as { kind: string; base?: string },
  grant: undefined as string | Error | undefined,
}));

vi.mock("@powerhousedao/reactor-browser", () => ({
  ambientRenownTokenProvider: () => Promise.resolve(undefined),
  recordBackendAuthError: () => undefined,
  useDrives: () => app.drives,
  useSelectedDriveSafe: () => [undefined],
}));
vi.mock("../../../../editors/sektar/kit/conversion-grant.js", () => ({
  useConversionGrant: () => () =>
    app.grant instanceof Error
      ? Promise.reject(app.grant)
      : Promise.resolve(app.grant),
}));
vi.mock("../../../../editors/sektar/kit/mail-index.js", () => ({
  useMailAccounts: () => null,
  useMailIndexMode: () => app.mode,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/* ---------------------------------------------------------------- a host */

const drive = (id: string, slug: string, name: string) =>
  ({
    header: { id, slug, name },
    state: { global: { name } },
  }) as unknown as DocumentDriveDocument;

const FILES = drive("drive-files", "files", "Documents");
const MAIL = drive("drive-mail", "mail", "Mail");
const ACCOUNTS = [
  {
    address: "Ada@Example.com",
    name: "Ada",
    provider: "gmail",
    total: 12,
    unread: 1,
  },
];
const HOST = "https://host.example";

const hostDefault = (): Settings =>
  settings({
    revision: 0,
    authorizingIdentity: "host-default",
    limits: {
      ...HOST_LIMITS,
      maxPages: 500,
    },
  });

function hostWith(initial: Settings = hostDefault()) {
  let saved = initial;
  const puts: PutConversionSettings[] = [];
  const renewals: { expectedRevision: number; workflowGrant?: string }[] = [];
  const batches = new Map<string, ConversionBatch>();
  const previews: ConversionBatchPreview[] = [];
  const calls: string[] = [];
  let refusePut: ConversionApiError | null = null;
  const base = createConversionClient({
    base: HOST,
    fetch: () => Promise.reject(new Error("an unexpected request")),
    token: () => Promise.resolve(undefined),
  });
  const client: ConversionClient = {
    ...base,
    capabilities: () => Promise.resolve(capabilities()),
    modelReadiness: () =>
      Promise.resolve({
        ready: true,
        files: [],
        totalBytes: 0,
        missingBytes: 0,
      }),
    preparations: () => Promise.resolve([]),
    settings: () => {
      calls.push("settings");
      return Promise.resolve(saved);
    },
    putSettings: (put) => {
      puts.push(put);
      if (refusePut) return Promise.reject(refusePut);
      if (saved.revision !== put.expectedRevision)
        return Promise.reject(
          new ConversionApiError(
            409,
            "revision-conflict",
            "These settings were changed by someone else. Reload them and try again.",
          ),
        );
      saved = settings({
        ...put,
        revision: saved.revision + 1,
        needsReview: false,
        authorizingIdentity: "0x1111111111111111111111111111111111112222",
      });
      return Promise.resolve(saved);
    },
    renewAccess: (input) => {
      renewals.push(input);
      return Promise.resolve();
    },
    previewBatch: (input) => {
      calls.push(`preview:${scopeKey(input.scope)}:${input.limit}`);
      const preview: ConversionBatchPreview = {
        id: `preview-${previews.length + 1}`,
        scope: input.scope,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        candidates: [
          FILE_SOURCE,
          {
            ...FILE_SOURCE,
            documentId: "file-2",
            fileName: "contract.pdf",
            sizeBytes: null,
          },
        ],
        scanned: 40,
        truncated: false,
        warnings: [],
      };
      previews.push(preview);
      return Promise.resolve(preview);
    },
    startBatch: (input) => {
      calls.push(`start:${input.previewId}:${input.requestId}`);
      const preview = previews.find((each) => each.id === input.previewId);
      if (!preview)
        return Promise.reject(
          new ConversionApiError(404, "not-found", "No such preview."),
        );
      const batch: ConversionBatch = {
        id: preview.id,
        scope: preview.scope,
        status: "running",
        jobIds: ["job-1"],
        createdAt: "2026-11-10T10:00:00.000Z",
      };
      batches.set(batch.id, batch);
      return Promise.resolve(batch);
    },
    batch: (id) => {
      const batch = batches.get(id);
      return batch
        ? Promise.resolve(batch)
        : Promise.reject(
            new ConversionApiError(404, "not-found", "No such batch."),
          );
    },
    cancelBatch: (id) => {
      calls.push(`cancel:${id}`);
      const batch = batches.get(id);
      if (!batch)
        return Promise.reject(
          new ConversionApiError(404, "not-found", "No such batch."),
        );
      const cancelled: ConversionBatch = { ...batch, status: "cancelled" };
      batches.set(id, cancelled);
      return Promise.resolve(cancelled);
    },
  };
  return {
    client,
    saved: () => saved,
    replace: (next: Settings) => {
      saved = next;
    },
    renewals,
    puts,
    batches,
    calls,
    refusePuts: (error: ConversionApiError | null) => (refusePut = error),
  };
}

/* ------------------------------------------------------------- the page */

let container: HTMLDivElement;
let root: Root;
let stored: Map<string, string>;

beforeEach(() => {
  app.grant = undefined;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  stored = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
    removeItem: (key: string) => void stored.delete(key),
  });
  app.drives = undefined;
  app.mode = { kind: "unknown" };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

async function show(node: ReactNode) {
  await act(async () => {
    root.render(node);
    await Promise.resolve();
  });
  await settle();
}

const form = (host: ReturnType<typeof hostWith>) => (
  <ConversionSettingsForm
    client={host.client}
    files={FILES}
    mail={MAIL}
    accounts={ACCOUNTS}
  />
);

const text = () => container.textContent;

const button = (name: string) =>
  [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent.trim() === name,
  );

async function press(name: string) {
  const found = button(name);
  if (!found && ["Off", "When I ask", "Automatically"].includes(name)) {
    pick("When to convert", name);
    await settle();
    return;
  }
  if (!found) throw new Error(`No button ${name}`);
  act(() => found.click());
  await settle();
}

/** The Save button, whatever count it names. */
function saveButton(): HTMLButtonElement {
  const found = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent.trim().startsWith("Save"),
  );
  if (!found) throw new Error("No Save button");
  return found;
}

async function pressSave() {
  await settle();
  const found = saveButton();
  act(() => found.click());
  await settle();
}

/** The checkbox or radio whose label starts with `label`. */
function choice(label: string): HTMLInputElement {
  const found = [...container.querySelectorAll("label")].find((candidate) =>
    candidate.textContent.trim().startsWith(label),
  );
  const input = found?.querySelector("input");
  if (!input) throw new Error(`No choice ${label}`);
  return input;
}

const tick = (label: string) => act(() => choice(label).click());

/** The control of the field labelled `label`. */
function field<T extends Element>(label: string, selector: string): T {
  const found = [...container.querySelectorAll(".sk-field")].find(
    (candidate) => candidate.querySelector(".sk-label")?.textContent === label,
  );
  const control = found?.querySelector<T>(selector);
  if (!control) throw new Error(`No field ${label}`);
  return control;
}

/** The cards under the legend `legend`: each one's name, ratings, description, and whether it is chosen or can be picked. */
function cards(legend: string) {
  const group = [
    ...container.querySelectorAll("fieldset.sk-choice-cards"),
  ].find(
    (candidate) => candidate.querySelector("legend")?.textContent === legend,
  );
  if (!group) throw new Error(`No cards ${legend}`);
  return [...group.querySelectorAll<HTMLLabelElement>(".sk-choice-card")].map(
    (card) => {
      const input = card.querySelector("input");
      if (!input) throw new Error("A card without its radio");
      return {
        input,
        name: card.querySelector(".sk-choice-card__name")?.textContent,
        facts: [...card.querySelectorAll(".sk-choice-card__fact")].map((fact) =>
          [...fact.children]
            .map((part) => part.getAttribute("aria-label") ?? part.textContent)
            .join(": "),
        ),
        description: card.querySelector(".sk-choice-card__text")?.textContent,
        chosen: input.checked,
        pickable: !input.disabled,
      };
    },
  );
}

function selectValue(label: string, value: string) {
  const select = field<HTMLSelectElement>(label, "select");
  act(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

/** Picks the card named `name` under the legend `legend`. */
function pick(legend: string, name: string) {
  const found = cards(legend).find((card) => card.name === name);
  if (!found) throw new Error(`No card ${name} under ${legend}`);
  act(() => found.input.click());
}

function type(label: string, value: string) {
  const input = field<HTMLInputElement>(label, "input");
  act(() => {
    // Past React's own value tracking, as typing does.
    Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(input) as object,
      "value",
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const hint = (label: string) =>
  [...container.querySelectorAll(".sk-field")]
    .find(
      (candidate) =>
        candidate.querySelector(".sk-label")?.textContent === label,
    )
    ?.querySelector(".sk-hint")?.textContent;

const FILES_KEY = scopeKey({ kind: "files", driveId: "drive-files" });
const ADA: ConversionScope = {
  kind: "mail",
  driveId: "drive-mail",
  account: "ada@example.com",
};

/* ------------------------------------------------------------------ pure */

describe("the sources available for batches", () => {
  it("are the Files drive and each mailbox, without settings attached", () => {
    const sources = sourcesOf({
      files: FILES,
      mail: MAIL,
      accounts: [
        ...ACCOUNTS,
        { address: "unknown", name: "", provider: null, total: 2, unread: 0 },
        {
          address: "ada@example.com",
          name: "Ada again",
          provider: "gmail",
          total: 1,
          unread: 0,
        },
      ],
    });
    expect(sources.map((source) => [source.label, source.scope])).toEqual([
      ["Files · Documents", { kind: "files", driveId: "drive-files" }],
      ["Mail · Ada", ADA],
      [
        "Mail · no account",
        { kind: "mail", driveId: "drive-mail", account: "unknown-account" },
      ],
    ]);
  });

  it("name a drive called Files once", () => {
    const [files] = sourcesOf({
      files: drive("drive-files", "files", "Files"),
      mail: undefined,
      accounts: [],
    });
    expect(files.label).toBe("Files");
  });

  it("name a mailbox the way the host does", () => {
    for (const address of [
      "Ada@Example.com",
      "  bob@x.io ",
      "",
      null,
      undefined,
    ]) {
      expect(mailAccountKey(address)).toBe(normalizeAccount(address));
    }
  });
});

describe("a batch", () => {
  const batch: ConversionBatch = {
    id: "batch-1",
    scope: FILES_SCOPE,
    status: "running",
    jobIds: ["a", "b", "c"],
    createdAt: "2026-11-10T10:00:00.000Z",
  };

  it("says when it recorded no runs, and what to do", () => {
    const empty = { ...batch, status: "complete" as const, jobIds: [] };
    expect(batchText(empty, "Files")).toBe(
      "Files: no conversion runs were recorded. Check the workflow host, then try again.",
    );
  });

  it("says in plain sentences what a preview found and what it skipped", () => {
    const preview: ConversionBatchPreview = {
      id: "preview-1",
      scope: FILES_SCOPE,
      expiresAt: "2026-11-10T10:15:00.000Z",
      candidates: [FILE_SOURCE],
      scanned: 6,
      truncated: false,
      warnings: [
        {
          code: "attachment-pending",
          message: "1 file is still syncing, so it's skipped.",
        },
      ],
    };
    expect(previewText(preview)).toBe(
      "1 PDF to convert. 1 file is still syncing, so it's skipped.",
    );
    expect(previewText({ ...preview, candidates: [], warnings: [] })).toBe(
      "No PDFs to convert.",
    );
    // A preview limited to one PDF.
    expect(
      previewText({
        ...preview,
        scanned: 5000,
        truncated: true,
        warnings: [{ code: "truncated", message: "Limited." }],
      }),
    ).toBe(
      "1 PDF to convert. This batch holds the first 1 PDFs. Convert the rest after it ends.",
    );
  });
});

describe("Settings → Document conversion", () => {
  it("saves one global configuration with no configuration source picker", async () => {
    const host = hostWith();
    await show(form(host));
    expect(text()).not.toContain("Apply these settings to");
    expect(text()).not.toContain("All sources");
    expect(cards("When to convert").map(({ name }) => name)).toEqual([
      "Off",
      "When I ask",
      "Automatically",
    ]);
    expect(saveButton().disabled).toBe(false);
    await press("Automatically");
    await pressSave();
    expect(host.puts).toHaveLength(1);
    expect(host.puts[0]).toMatchObject({
      expectedRevision: 0,
      activation: "automatic",
    });
    expect(host.puts[0]).not.toHaveProperty("scope");
    expect(saveButton().disabled).toBe(true);
    expect(text()).toContain("Settings saved for the whole app.");
  });

  it("saves before sources exist and does not depend on source inventory", async () => {
    const host = hostWith();
    await show(
      <ConversionSettingsForm
        client={host.client}
        files={undefined}
        mail={undefined}
        accounts={[]}
      />,
    );
    await pressSave();
    expect(host.puts).toHaveLength(1);
    expect(button("Review PDFs…")?.disabled).toBe(true);
  });

  it("renews app-wide access without applying unsaved edits", async () => {
    const host = hostWith(settings());
    app.grant = "app-statement";
    await show(form(host));
    pick("Method", "Text only");
    await press("Use my access only");
    expect(host.puts).toHaveLength(0);
    expect(host.renewals).toEqual([
      {
        expectedRevision: host.saved().revision,
        workflowGrant: "app-statement",
      },
    ]);
    expect(
      cards("Method").find((card) => card.name === "Text only")?.chosen,
    ).toBe(true);
    expect(saveButton().disabled).toBe(false);
    expect(text()).toContain("Your saved settings have not changed.");
  });

  it("shows the effective file cap without persisting it over the saved limit", async () => {
    const original = settings({
      limits: { ...HOST_LIMITS, maxBytes: 50 * 1024 * 1024 },
    });
    const host = hostWith(original);
    host.client.capabilities = () =>
      Promise.resolve(
        capabilities({
          execution: {
            kind: "workflow",
            runningCancellation: false,
            pageProgress: false,
            maxFileBytes: 8 * 1024 * 1024,
          },
        }),
      );
    await show(form(host));
    expect(text()).toContain("8.0 MB per PDF");
    await press("Automatically");
    await pressSave();
    expect(host.puts[0].limits.maxBytes).toBe(original.limits.maxBytes);
  });

  it("saves an app grant and can still turn Off when signing is unavailable", async () => {
    const host = hostWith();
    app.grant = "app-statement";
    await show(form(host));
    await press("Automatically");
    await pressSave();
    expect(host.puts[0].workflowGrant).toBe("app-statement");
    app.grant = new UserFacingError("Sign in to authorize conversion.");
    await press("When I ask");
    await pressSave();
    expect(host.puts).toHaveLength(1);
    expect(text()).toContain("Sign in to authorize conversion.");
    await press("Off");
    await pressSave();
    expect(host.puts).toHaveLength(2);
    expect(host.puts[1].workflowGrant).toBeUndefined();
  });

  it("requires review of migrated source settings without changing saved Markdown", async () => {
    const host = hostWith(settings({ activation: "off", needsReview: true }));
    await show(form(host));
    expect(text()).toContain("Per-source settings have been replaced.");
    expect(saveButton().disabled).toBe(false);
    await press("When I ask");
    await pressSave();
    expect(host.saved().needsReview).toBe(false);
    expect(text()).not.toContain("Per-source settings have been replaced.");
  });

  it("discards edits and does not offer saving an unchanged stored configuration", async () => {
    const host = hostWith(settings());
    await show(form(host));
    expect(saveButton().disabled).toBe(true);
    await press("Off");
    expect(text()).toContain("A conversion already running may still finish.");
    expect(
      container.querySelector(".sk-convert-settings__save.is-dirty"),
    ).not.toBeNull();
    await press("Discard changes");
    expect(saveButton().disabled).toBe(true);
    expect(
      container.querySelector(".sk-convert-settings__save.is-dirty"),
    ).toBeNull();
  });

  it("shows what the host cannot run with its reason, and does not save it", async () => {
    const host = hostWith(
      settings({
        profile: withRecognition(settings().profile, "paddleocr"),
      }),
    );
    await show(form(host));
    expect(
      cards("Scanner").map(({ name, pickable }) => [name, pickable]),
    ).toEqual([
      ["Tesseract", true],
      ["PaddleOCR (needs setup)", true],
    ]);
    expect(text()).toContain("PaddleOCR needs setup.");
    expect(text()).toContain("PaddleOCR is not installed on this host.");
    await press("Automatically");
    expect(saveButton().disabled).toBe(true);

    // Another engine can be picked; the one that needs setup can no longer be.
    pick("Scanner", "Tesseract");
    expect(text()).not.toContain("PaddleOCR needs setup.");
    expect(
      cards("Scanner").find(({ name }) => name?.startsWith("PaddleOCR"))
        ?.pickable,
    ).toBe(false);
    await settle();
    expect(saveButton().disabled).toBe(false);
  });

  it("puts the scanner under the method, with that scanner's own options under it", async () => {
    const host = hostWith();
    const offered = capabilities();
    host.client.capabilities = () =>
      Promise.resolve(
        capabilities({
          ocr: [
            offered.ocr[0],
            {
              ...offered.ocr[1],
              availability: { status: "available", version: "paddle@3" },
              models: ["v6Small", "v6Medium", "v6Tiny"],
            },
          ],
        }),
      );
    await show(form(host));
    const order = () =>
      [
        ...container.querySelectorAll(
          ".sk-convert-reading :is(.sk-label, .sk-sync-check__label)",
        ),
      ].map((label) => label.textContent);
    expect(order()).toEqual(["Method", "Scanner", "Languages"]);
    expect(
      cards("Scanner").map(({ name, facts, description }) => [
        name,
        facts,
        description,
      ]),
    ).toEqual([
      [
        "Tesseract",
        ["Speed: 4 of 5", "Photos & small print: 2 of 5"],
        "Best for clean, printed pages, like typed letters and forms.",
      ],
      [
        "PaddleOCR",
        ["Speed: 2 of 5", "Photos & small print: 4 of 5"],
        "Better with harder pages, like photos of paper or small print. Slower. Download the scanner once, then use it offline.",
      ],
    ]);

    pick("Scanner", "PaddleOCR");
    expect(order()).toEqual(["Method", "Scanner", "Speed and accuracy"]);
    expect(
      cards("Speed and accuracy").map(
        ({ name, facts, description, chosen }) => [
          name,
          facts,
          description,
          chosen,
        ],
      ),
    ).toEqual([
      [
        "Fastest",
        ["Speed: 5 of 5", "Accuracy: 2 of 5"],
        "Quickest, but may miss more words.",
        false,
      ],
      [
        "Balanced",
        ["Speed: 3 of 5", "Accuracy: 4 of 5"],
        "Recommended. Good speed and accuracy, in 50+ languages.",
        true,
      ],
      [
        "Most accurate",
        ["Speed: 1 of 5", "Accuracy: 5 of 5"],
        "Misses the fewest words, but takes longer.",
        false,
      ],
    ]);
    pick("Speed and accuracy", "Fastest");

    pick("Method", "Text only");
    expect(order()).toEqual(["Method"]);

    pick("Method", "Scan every page");
    await pressSave();
    expect(host.puts[0].profile.reading).toEqual({
      kind: "recognize",
      engine: {
        kind: "ocr",
        engine: "paddleocr",
        languages: ["eng"],
        model: "v6Tiny",
      },
    });
  });

  it("offers the host's OCR languages and keeps at least one", async () => {
    const host = hostWith();
    await show(form(host));
    expect(choice("English").checked).toBe(true);
    expect(choice("English").disabled).toBe(true);
    tick("Spanish");
    await pressSave();
    expect(host.puts[0].profile.reading).toMatchObject({
      fallback: { kind: "ocr", engine: "tesseract", languages: ["eng", "spa"] },
    });
  });

  it("offers no AI method, scanner, layout option or limit", async () => {
    const host = hostWith();
    await show(form(host));
    expect(text()).not.toContain("Improve layout with AI");
    expect(text()).not.toContain("AI transcription");
    expect(text()).not.toContain("Integrated AI");
    expect(cards("Method").map(({ name }) => name)).toEqual([
      "Standard",
      "Text only",
      "Scan every page",
    ]);
    expect(cards("Scanner").map(({ name }) => name)).toEqual([
      "Tesseract",
      "PaddleOCR (needs setup)",
    ]);
    expect(() => field("AI pages per PDF", "input")).toThrow();
    expect(() => field("AI requests per PDF", "input")).toThrow();
    expect(() => field("Automatic AI pages per day", "input")).toThrow();
    expect(field<HTMLInputElement>("Pages per PDF", "input").value).toBe("500");
  });

  it("folds the limits under their values, with the host's most in each field", async () => {
    const host = hostWith();
    await show(form(host));
    const limits = container.querySelector("details");
    expect(limits?.open).toBe(false);
    expect(limits?.querySelector("summary")?.textContent).toBe(
      "Conversion limits500 pages and 200.0 MB per PDF, 120 minutes per conversion",
    );
    expect(
      field("Pages per PDF", ".sk-convert-settings__unit").textContent,
    ).toBe("pages");
    expect(hint("Pages per PDF")).toBe("Maximum allowed: 2,000");
    expect(text()).not.toContain("This host allows up to");
  });

  it("holds each limit to what the host allows", async () => {
    const host = hostWith();
    await show(form(host));
    type("Pages per PDF", "5000");
    expect(hint("Pages per PDF")).toBe("This host allows at most 2,000.");
    expect(text()).toContain("A limit needs fixing.");
    expect(saveButton().disabled).toBe(true);
    type("Pages per PDF", "");
    expect(hint("Pages per PDF")).toBe("A whole number, 1 or more.");
    await press("Discard changes");
    expect(field<HTMLInputElement>("Pages per PDF", "input").value).toBe("500");
  });

  it("turns the app off without asking how it would read", async () => {
    const host = hostWith();
    await show(form(host));
    await press("Off");
    expect(
      cards("Method")[0].input.closest<HTMLFieldSetElement>(
        "fieldset.sk-convert-settings__section",
      )?.disabled,
    ).toBe(true);
    expect(
      field<HTMLInputElement>("Pages per PDF", "input").closest("fieldset")
        ?.disabled,
    ).toBe(true);
    await pressSave();
    expect(host.puts.map((put) => put.activation)).toEqual(["off"]);
    expect(text()).toContain("Settings saved for the whole app.");
  });

  it("rejects a stale global save and preserves edits for review", async () => {
    const host = hostWith();
    await show(form(host));
    host.replace(settings({ revision: 1, activation: "automatic" }));
    await press("Off");
    await pressSave();
    expect(text()).toContain("Changes were not saved");
    expect(text()).toContain("The latest settings have been loaded.");
    expect(host.saved().activation).toBe("automatic");
    expect(
      cards("When to convert").find((card) => card.name === "Off")?.chosen,
    ).toBe(true);
    expect(button("Save changes")?.disabled).toBe(true);
    await press("Discard changes");
    await press("Off");
    await pressSave();
    expect(host.puts[1].expectedRevision).toBe(1);
    expect(host.saved().activation).toBe("off");
  });

  it("says when the host has no conversion service, or did not answer", async () => {
    const none = hostWith();
    none.client.capabilities = () =>
      Promise.reject(new ConversionApiError(404, null, "Not found"));
    await show(form(none));
    expect(text()).toContain(
      "This Sektar host does not offer document conversion.",
    );

    act(() => root.unmount());
    root = createRoot(container);
    const down = hostWith();
    down.client.settings = () =>
      Promise.reject(new Error("The host did not answer."));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await show(form(down));
    expect(text()).toContain(
      "Sektar couldn't load the conversion settings. Try again in a moment.",
    );
    expect(text()).not.toContain("The host did not answer.");
    warn.mockRestore();
  });
});

/* --------------------------------------------------------------- batches */

describe("Convert existing PDFs", () => {
  it("lists a source's PDFs on opening, starts only when confirmed, and can be cancelled afterwards", async () => {
    const host = hostWith();
    await show(form(host));
    await press("Review PDFs…");
    expect(host.calls).toContain(`preview:${FILES_KEY}:90`);
    expect(text()).toContain("2 PDFs to convert.");
    expect(text()).toContain(
      "Uses your saved app settings: Standard, English.",
    );
    const rows = [...container.querySelectorAll(".sk-convert-batch__list li")];
    expect(rows.map((row) => row.textContent)).toEqual([
      "PDFinvoice.pdf242 KB",
      "PDFcontract.pdf",
    ]);
    expect(button("Preview")).toBeUndefined();
    expect(host.batches.size).toBe(0);

    await press("Convert 2 PDFs");
    expect(
      host.calls.filter((call) => call.startsWith("start:preview-1:")),
    ).toHaveLength(1);
    // The dialog closes; the batch is followed on the page, where it can be stopped.
    expect(button("Convert 2 PDFs")).toBeUndefined();
    expect(text()).toContain(
      "Files · Documents: converting 1 PDF. It keeps going if you close this page.",
    );
    // This browser remembers the batch it started.
    act(() => root.unmount());
    root = createRoot(container);
    await show(form(host));
    expect(text()).toContain("Files · Documents: converting 1 PDF.");

    await press("Cancel waiting runs");
    expect(host.calls).toContain("cancel:preview-1");
    expect(text()).toContain("Files · Documents: batch cancelled.");
    expect(text()).toContain("Running conversions continue.");
    expect(button("Cancel waiting runs")).toBeUndefined();
  });

  it("lists the PDFs again under a new request after a failed start", async () => {
    const host = hostWith();
    const ids: string[] = [];
    host.client.startBatch = (input) => {
      ids.push(input.requestId);
      return Promise.reject(
        new ConversionApiError(503, "runtime", "Runtime unavailable"),
      );
    };
    await show(form(host));
    await press("Review PDFs…");
    await press("Convert 2 PDFs");
    expect(text()).toContain(
      "Runtime unavailable Some PDFs may have started converting anyway, so check them before you try again.",
    );
    expect(button("Convert")?.disabled).toBe(true);
    await press("Try again");
    await press("Convert 2 PDFs");
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it("lists again on a change of source, and ignores an earlier answer that comes late", async () => {
    const host = hostWith();
    const answers: {
      scope: ConversionScope;
      resolve: (preview: ConversionBatchPreview) => void;
    }[] = [];
    host.client.previewBatch = (input) =>
      new Promise((resolve) => answers.push({ scope: input.scope, resolve }));
    const answer = (at: number, fileName: string) =>
      act(() => {
        const { scope, resolve } = answers[at];
        resolve({
          id: `preview-${at}`,
          scope,
          expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
          candidates: [{ ...FILE_SOURCE, scope, fileName }],
          scanned: 1,
          truncated: false,
          warnings: [],
        });
      });
    await show(form(host));
    await press("Review PDFs…");
    expect(text()).toContain("Listing PDFs in this source…");
    expect(button("Convert")?.disabled).toBe(true);

    selectValue("From", scopeKey(ADA));
    await settle();
    expect(answers.map((each) => scopeKey(each.scope))).toEqual([
      FILES_KEY,
      scopeKey(ADA),
    ]);
    answer(1, "from-mail.pdf");
    await settle();
    answer(0, "from-files.pdf");
    await settle();
    expect(text()).toContain("from-mail.pdf");
    expect(text()).not.toContain("from-files.pdf");
    expect(button("Convert 1 PDF")?.disabled).toBe(false);
  });

  it("says how to try again when listing fails", async () => {
    const host = hostWith();
    const list = host.client.previewBatch.bind(host.client);
    host.client.previewBatch = () =>
      Promise.reject(new ConversionApiError(503, "runtime", "Host busy."));
    await show(form(host));
    await press("Review PDFs…");
    expect(text()).toContain("Host busy.");
    host.client.previewBatch = list;
    await press("Try again");
    expect(text()).toContain("2 PDFs to convert.");
  });

  it("lists an expired preview again without an error", async () => {
    vi.useFakeTimers();
    const host = hostWith();
    await act(async () => {
      root.render(form(host));
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      button("Review PDFs…")?.click();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(host.calls.filter((call) => call.startsWith("preview:"))).toEqual([
      `preview:${FILES_KEY}:90`,
    ]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000);
    });
    expect(
      host.calls.filter((call) => call.startsWith("preview:")),
    ).toHaveLength(2);
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(text()).toContain("2 PDFs to convert.");
  });

  it("says when a source holds more than one batch, and offers the next PDFs once it ends", async () => {
    vi.useFakeTimers();
    const host = hostWith();
    const list = host.client.previewBatch.bind(host.client);
    host.client.previewBatch = async (input) => ({
      ...(await list(input)),
      truncated: true,
      candidates: Array.from({ length: 90 }, (_, at) => ({
        ...FILE_SOURCE,
        documentId: `file-${at}`,
        fileName: `scan-${at}.pdf`,
      })),
    });
    await act(async () => {
      root.render(form(host));
      await vi.advanceTimersByTimeAsync(10);
    });
    await act(async () => {
      button("Review PDFs…")?.click();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(text()).toContain(
      "90 PDFs to convert. This batch holds the first 90 PDFs. Convert the rest after it ends.",
    );
    expect(
      container.querySelectorAll(".sk-convert-batch__list li"),
    ).toHaveLength(90);
    await act(async () => {
      button("Convert 90 PDFs")?.click();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(button("Convert the next PDFs")).toBeUndefined();

    const batch = host.batches.get("preview-1");
    if (batch) host.batches.set(batch.id, { ...batch, status: "complete" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
    expect(text()).toContain("Files · Documents: batch of 1 PDF finished.");
    await act(async () => {
      button("Convert the next PDFs")?.click();
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(field<HTMLSelectElement>("From", "select").value).toBe(FILES_KEY);
    expect(
      host.calls.filter((call) => call.startsWith("preview:")),
    ).toHaveLength(2);
  });

  it("starts one batch at a time from this browser", async () => {
    const host = hostWith();
    host.batches.set("batch-old", {
      id: "batch-old",
      scope: ADA,
      status: "running",
      jobIds: ["a", "b"],
      createdAt: "2026-11-10T09:00:00.000Z",
    });
    stored.set(
      "sektar:conversion-batches",
      JSON.stringify([{ host: HOST, id: "batch-old" }]),
    );
    await show(form(host));
    await press("Review PDFs…");
    expect(text()).toContain("2 PDFs to convert.");
    expect(text()).toContain(
      "A batch is still running. Start the next one when it ends.",
    );
    expect(button("Convert 2 PDFs")?.disabled).toBe(true);
  });

  it("blocks batch previews from every source when global conversion is Off", async () => {
    const host = hostWith(
      settings({
        activation: "off",
      }),
    );
    await show(form(host));
    await press("Review PDFs…");
    expect(text()).toContain("Conversion is off for the app.");
    expect(host.calls.some((call) => call.startsWith("preview:"))).toBe(false);
    selectValue("From", scopeKey(ADA));
    await settle();
    expect(host.calls.some((call) => call.startsWith("preview:"))).toBe(false);
  });

  it("follows a batch this browser started earlier, and forgets one that ended", async () => {
    const host = hostWith();
    host.batches.set("batch-old", {
      id: "batch-old",
      scope: ADA,
      status: "running",
      jobIds: ["a", "b"],
      createdAt: "2026-11-10T09:00:00.000Z",
    });
    host.batches.set("batch-done", {
      id: "batch-done",
      scope: ADA,
      status: "complete",
      jobIds: ["c"],
      createdAt: "2026-11-10T08:00:00.000Z",
    });
    stored.set(
      "sektar:conversion-batches",
      JSON.stringify([
        { host: HOST, id: "batch-old" },
        { host: HOST, id: "batch-done" },
        { host: HOST, id: "batch-gone" },
        { host: "https://other.example", id: "batch-elsewhere" },
      ]),
    );
    await show(form(host));
    expect(text()).toContain("Mail · Ada: converting 2 PDFs.");
    expect(text()).not.toContain("finished");
  });

  it("shows a running batch as ended once the host says so", async () => {
    vi.useFakeTimers();
    const host = hostWith();
    host.batches.set("batch-1", {
      id: "batch-1",
      scope: { kind: "files", driveId: "drive-files" },
      status: "running",
      jobIds: ["a"],
      createdAt: "2026-11-10T09:00:00.000Z",
    });
    stored.set(
      "sektar:conversion-batches",
      JSON.stringify([{ host: HOST, id: "batch-1" }]),
    );
    await act(async () => {
      root.render(form(host));
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(text()).toContain("converting 1 PDF");
    const running = host.batches.get("batch-1");
    if (running)
      host.batches.set("batch-1", { ...running, status: "complete" });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_100);
    });
    expect(text()).toContain(
      "Files · Documents: batch of 1 PDF finished. Each PDF shows how its conversion went.",
    );
    // Only a batch started in this visit knows it held part of its source.
    expect(button("Convert the next PDFs")).toBeUndefined();
  });
});

/* -------------------------------------------------------------- the tab */

describe("the Document conversion tab", () => {
  it("says what it waits for when there is no host to ask", async () => {
    await show(<ConversionSettings />);
    expect(text()).toContain("Looking for the Sektar host behind your app…");

    app.drives = [];
    await show(<ConversionSettings />);
    expect(text()).toContain(
      "Connect to a Sektar host to set up document conversion.",
    );

    app.drives = [FILES];
    app.mode = { kind: "local" };
    await show(<ConversionSettings />);
    expect(text()).toContain("These drives live in this browser only");
  });

  it("asks the host behind the drives, on the package's own route", async () => {
    app.drives = [FILES];
    app.mode = { kind: "remote", base: HOST };
    const asked: string[] = [];
    vi.stubGlobal("fetch", (input: string) => {
      asked.push(input);
      const body = input.includes("/capabilities")
        ? capabilities()
        : hostDefault();
      return Promise.resolve(new Response(JSON.stringify(body)));
    });
    await show(<ConversionSettings />);
    expect(text()).toContain("These settings apply throughout Files and Mail");
    expect(text()).toContain("When to convert");
    expect(asked).toContain(
      `${HOST}/api/@powerhousedao/sektar/conversion/capabilities`,
    );
    expect(asked).toContain(
      `${HOST}/api/@powerhousedao/sektar/conversion/settings`,
    );
  });
});

it("preserves another administrator's Off setting when an edited draft refreshes", async () => {
  const initial = settings({ revision: 1, activation: "manual" });
  const h = hostWith(initial);
  await show(form(h));
  pick("Method", "Text only");
  h.replace(settings({ ...initial, revision: 2, activation: "off" }));
  await act(() => window.dispatchEvent(new Event("focus")));
  await settle();
  expect(button("Save changes")?.disabled).toBe(true);
  expect(text()).toContain("Settings changed elsewhere");
  expect(h.saved().activation).toBe("off");
  expect(h.puts).toHaveLength(0);
  await press("Discard changes");
  expect(
    cards("When to convert").find((card) => card.name === "Off")?.chosen,
  ).toBe(true);
});

it.each([503, 403])(
  "recovers a remembered batch after an initial %i response",
  async (status) => {
    vi.useFakeTimers();
    const host = hostWith();
    host.batches.set("batch-old", {
      id: "batch-old",
      scope: ADA,
      status: "running",
      jobIds: ["a", "b"],
      createdAt: "2026-11-10T09:00:00.000Z",
    });
    stored.set(
      "sektar:conversion-batches",
      JSON.stringify([{ host: HOST, id: "batch-old" }]),
    );
    const readBatch = host.client.batch.bind(host.client);
    let failing = true;
    let calls = 0;
    host.client.batch = (id, signal) => {
      calls++;
      return failing
        ? Promise.reject(
            new ConversionApiError(
              status,
              "unavailable",
              "Temporarily unavailable",
            ),
          )
        : readBatch(id, signal);
    };
    await act(async () => {
      root.render(form(host));
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(calls).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_000);
    });
    if (status === 403) expect(calls).toBe(1);
    else expect(calls).toBeGreaterThan(1);
    failing = false;
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("online"));
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(text()).toContain("Mail · Ada: converting 2 PDFs.");
    expect(calls).toBeGreaterThan(1);
  },
);

it("offers setup for unchanged saved settings with a cold cache and retains the failed proposal for retry", async () => {
  const host = hostWith(settings());
  host.client.modelReadiness = () =>
    Promise.resolve({
      ready: false,
      files: [{ id: "english", label: "English", bytes: 100, ready: false }],
      totalBytes: 100,
      missingBytes: 100,
    });
  let preparation: ModelPreparation | null = null;
  host.client.preparations = () =>
    Promise.resolve(preparation ? [preparation] : []);
  const save = vi.fn<ConversionClient["putSettings"]>((put) => {
    const { workflowGrant: _grant, requestId: _id, ...proposal } = put;
    preparation = {
      kind: "preparation",
      id: put.requestId ?? "download",
      intent: { kind: "settings", settings: proposal },
      progress: {
        phase: "failed",
        transferredBytes: 40,
        totalBytes: 100,
        readyFiles: 0,
        totalFiles: 1,
        file: "English",
      },
      updatedAt: new Date().toISOString(),
      result: null,
      error: {
        code: "download-failed",
        message: "Connection failed. Retry the download.",
        retryable: true,
      },
    };
    return Promise.resolve(preparation);
  });
  host.client.putSettings = save;
  await show(form(host));
  expect(button("Download and save")?.disabled).toBe(false);
  expect(text()).toContain("100 B to download");
  expect(save).not.toHaveBeenCalled();
  await press("Automatically");
  await press("Download and save");
  expect(save).toHaveBeenCalledTimes(1);
  expect(text()).toContain("Connection failed. Retry the download.");
  expect(button("Retry download")).toBeDefined();
  expect(choice("Automatically").checked).toBe(true);
  await show(<div />);
  await show(form(host));
  expect(text()).toContain("Connection failed. Retry the download.");
  expect(choice("Automatically").checked).toBe(true);
});

it("keeps Off actionable while setup runs, and shows verification and completion", async () => {
  const host = hostWith(settings());
  const { profile, activation, limits, revision } = host.saved();
  let preparation: ModelPreparation = {
    kind: "preparation",
    id: "pending",
    intent: {
      kind: "settings",
      settings: { activation, profile, limits, expectedRevision: revision },
    },
    progress: {
      phase: "downloading",
      transferredBytes: 25,
      totalBytes: 100,
      readyFiles: 0,
      totalFiles: 1,
      file: "English",
    },
    updatedAt: new Date().toISOString(),
    result: null,
    error: null,
  };
  host.client.preparations = () => Promise.resolve([preparation]);
  await show(form(host));
  expect(
    container
      .querySelector('[role="progressbar"]')
      ?.getAttribute("aria-valuenow"),
  ).toBe("25");
  expect(choice("Off").disabled).toBe(false);
  await press("Off");
  expect(saveButton().disabled).toBe(false);
  await pressSave();
  expect(host.saved().activation).toBe("off");
  expect(choice("Off").checked).toBe(true);
  preparation = {
    ...preparation,
    progress: { ...preparation.progress, phase: "failed" },
    error: {
      code: "revision-conflict",
      message: "These settings changed. Review them before saving.",
      retryable: false,
    },
  };
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  await settle();
  expect(text()).toContain(
    "These settings changed. Review them before saving.",
  );
  expect(choice("Off").checked).toBe(true);
});

it("does not show an old scanner success for a new selection", async () => {
  const host = hostWith(settings());
  const { profile, activation, limits, revision } = host.saved();
  host.client.preparations = () =>
    Promise.resolve([
      {
        kind: "preparation",
        id: "old-success",
        intent: {
          kind: "settings",
          settings: {
            activation,
            profile,
            limits,
            expectedRevision: revision - 1,
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
        updatedAt: new Date().toISOString(),
        result: { kind: "settings", settings: host.saved() },
        error: null,
      },
    ]);
  host.client.modelReadiness = () =>
    Promise.resolve({
      ready: false,
      files: [{ id: "french", label: "French", bytes: 200, ready: false }],
      totalBytes: 200,
      missingBytes: 200,
    });
  await show(form(host));
  expect(text()).not.toContain("Scanner ready · settings saved");
  expect(text()).toContain("200 B to download");
  tick("Spanish");
  await settle();
  expect(text()).not.toContain("Scanner ready · settings saved");
  expect(text()).toContain("200 B to download");
});

it("reconciles a lost save acknowledgement from the completed host intent", async () => {
  const host = hostWith(settings());
  let preparation: ModelPreparation | null = null;
  host.client.preparations = () =>
    Promise.resolve(preparation ? [preparation] : []);
  host.client.putSettings = (put) => {
    const { requestId: _id, workflowGrant: _grant, ...proposal } = put;
    const saved = settings({
      ...proposal,
      revision: host.saved().revision + 1,
    });
    host.replace(saved);
    preparation = {
      kind: "preparation",
      id: put.requestId ?? "lost-response",
      intent: { kind: "settings", settings: proposal },
      progress: {
        phase: "complete",
        transferredBytes: 100,
        totalBytes: 100,
        readyFiles: 1,
        totalFiles: 1,
        file: null,
      },
      updatedAt: new Date().toISOString(),
      result: { kind: "settings", settings: saved },
      error: null,
    };
    return Promise.reject(new Error("Response lost"));
  };
  await show(form(host));
  await press("Automatically");
  await pressSave();
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  await settle();
  expect(text()).toContain("Scanner ready · settings saved");
  expect(text()).not.toContain("Settings changed elsewhere");
  expect(text()).not.toContain("Changes were not saved");
  expect(button("Discard changes")).toBeUndefined();
});
